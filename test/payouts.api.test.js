const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor, makeUser } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Payroll = require('../src/models/Payroll');
const PayrollRun = require('../src/models/PayrollRun');
const PayoutTransaction = require('../src/models/PayoutTransaction');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/**
 * PayoutTransaction has no organizationId of its own — it is scoped through the
 * Payroll record it belongs to. That indirection is the thing most likely to
 * leak across tenants, so every test here seeds a full Payroll → Payout chain
 * for two organizations and asserts the boundary holds.
 */
const seedPayout = async ({ organizationId, employee, status = 'processed', amount = 50000, month = 6 }) => {
    const payroll = await Payroll.create({
        organizationId, employee, month, year: 2026,
        grossSalary: amount, netPay: amount,
    });
    const txn = await PayoutTransaction.create({
        organizationId, payrollId: payroll._id, employeeId: employee, amount, status,
    });
    return { payroll, txn };
};

describe('Payouts API', () => {
    let adminA, adminB, employeeA, empUserA, empUserB;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        adminA = await authFor({ role: 'admin', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
        employeeA = await authFor({ role: 'employee', organizationId: ORG_A });
        empUserA = await makeUser({ role: 'employee', organizationId: ORG_A });
        empUserB = await makeUser({ role: 'employee', organizationId: ORG_B });
    });

    describe('access control', () => {
        for (const path of ['/api/payouts/status', '/api/payouts/history']) {
            test(`${path} requires authentication`, async () => {
                assert.equal((await request(app).get(path)).status, 401);
            });

            test(`${path} is refused to an employee`, async () => {
                const res = await request(app).get(path).set('Authorization', employeeA.header);
                assert.equal(res.status, 403);
            });
        }
    });

    describe('status summary', () => {
        test('counts only this organization\'s payouts', async () => {
            await seedPayout({ organizationId: ORG_A, employee: empUserA._id, status: 'processed' });
            await seedPayout({ organizationId: ORG_A, employee: empUserA._id, status: 'failed', month: 5 });
            await seedPayout({ organizationId: ORG_B, employee: empUserB._id, status: 'processed' });

            const res = await request(app).get('/api/payouts/status').set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.total, 2, 'org A must not see org B payouts');
            assert.equal(res.body.data.processed, 1);
            assert.equal(res.body.data.failed, 1);
        });

        test('reports zeroes for an organization with no payouts', async () => {
            await seedPayout({ organizationId: ORG_B, employee: empUserB._id });
            const res = await request(app).get('/api/payouts/status').set('Authorization', adminA.header);
            assert.equal(res.body.data.total, 0);
        });
    });

    describe('history', () => {
        test('lists only this organization\'s transactions', async () => {
            await seedPayout({ organizationId: ORG_A, employee: empUserA._id });
            await seedPayout({ organizationId: ORG_B, employee: empUserB._id });

            const res = await request(app).get('/api/payouts/history').set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.length, 1);
        });

        test('exposes the failure reason for a failed payout', async () => {
            const { txn } = await seedPayout({ organizationId: ORG_A, employee: empUserA._id, status: 'failed' });
            await PayoutTransaction.updateOne({ _id: txn._id }, { errorMessage: 'Invalid IFSC' });

            const res = await request(app).get('/api/payouts/history').set('Authorization', adminA.header);
            assert.equal(res.body.data[0].failureReason, 'Invalid IFSC');
        });
    });

    describe('GET /api/payouts/run/:runId', () => {
        const makeRun = async (organizationId, payrollIds) => PayrollRun.create({
            month: 6, year: 2026, organizationId, status: 'locked', payrollRecords: payrollIds,
        });

        test('returns the transactions belonging to that run', async () => {
            const { payroll } = await seedPayout({ organizationId: ORG_A, employee: empUserA._id });
            const run = await makeRun(ORG_A, [payroll._id]);

            const res = await request(app).get(`/api/payouts/run/${run._id}`).set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.length, 1);
            assert.equal(res.body.run.status, 'locked');
        });

        test("404s for a run belonging to another organization", async () => {
            const { payroll } = await seedPayout({ organizationId: ORG_A, employee: empUserA._id });
            const run = await makeRun(ORG_A, [payroll._id]);

            const res = await request(app).get(`/api/payouts/run/${run._id}`).set('Authorization', adminB.header);
            assert.equal(res.status, 404, 'a cross-tenant runId must not leak its payouts');
        });

        test('404s for a run that does not exist', async () => {
            const res = await request(app)
                .get(`/api/payouts/run/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', adminA.header);
            assert.equal(res.status, 404);
        });

        test('returns an empty list for a run with no payouts yet', async () => {
            const run = await makeRun(ORG_A, []);
            const res = await request(app).get(`/api/payouts/run/${run._id}`).set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.data, []);
        });
    });

    describe('initiate guards', () => {
        test('refuses when neither payrollId nor runId is supplied', async () => {
            const res = await request(app).post('/api/payouts/initiate')
                .set('Authorization', adminA.header).send({});
            assert.equal(res.status, 400);
            assert.match(res.body.message, /required/i);
        });

        test('refuses a run that is not locked', async () => {
            const run = await PayrollRun.create({
                month: 6, year: 2026, organizationId: ORG_A, status: 'approved', payrollRecords: [],
            });
            const res = await request(app).post('/api/payouts/initiate')
                .set('Authorization', adminA.header).send({ runId: run._id });
            assert.equal(res.status, 400);
            assert.match(res.body.message, /locked/i);
        });

        test('refuses an unknown run', async () => {
            const res = await request(app).post('/api/payouts/initiate')
                .set('Authorization', adminA.header)
                .send({ runId: new mongoose.Types.ObjectId() });
            assert.equal(res.status, 404);
        });
    });
});
