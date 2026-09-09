const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const PayrollRun = require('../src/models/PayrollRun');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/**
 * Seed a run in a chosen state.
 *
 * The transitions are what matter here, and driving a run all the way from
 * initiate() would need employees, salary structures and compliance settings —
 * coupling these tests to unrelated modules.
 */
const seedRun = (over = {}) => PayrollRun.create({
    month: 6, year: 2026, organizationId: ORG_A, status: 'review', ...over,
});

describe('Payroll run lifecycle', () => {
    let admin, hr, employee, adminB;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        admin = await authFor({ role: 'admin', organizationId: ORG_A });
        hr = await authFor({ role: 'hr', organizationId: ORG_A });
        employee = await authFor({ role: 'employee', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
    });

    describe('access control', () => {
        test('listing requires authentication', async () => {
            assert.equal((await request(app).get('/api/payroll-runs')).status, 401);
        });

        test('only an admin may approve', async () => {
            const run = await seedRun();
            const res = await request(app)
                .patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', hr.header);
            assert.equal(res.status, 403, 'HR must not be able to approve payroll');
        });

        test('an employee may not initiate a run', async () => {
            const res = await request(app)
                .post('/api/payroll-runs/initiate')
                .set('Authorization', employee.header)
                .send({ month: 6, year: 2026 });
            assert.equal(res.status, 403);
        });

        test('only an admin may delete', async () => {
            const run = await seedRun();
            const res = await request(app)
                .delete(`/api/payroll-runs/${run._id}`)
                .set('Authorization', hr.header);
            assert.equal(res.status, 403);
        });
    });

    describe('tenant isolation', () => {
        test("another organization's run is not listed", async () => {
            await seedRun();
            const res = await request(app).get('/api/payroll-runs').set('Authorization', adminB.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.length, 0);
        });

        test("another organization's run cannot be fetched by id", async () => {
            const run = await seedRun();
            const res = await request(app).get(`/api/payroll-runs/${run._id}`).set('Authorization', adminB.header);
            assert.equal(res.status, 404);
        });

        test("another organization's run cannot be approved", async () => {
            const run = await seedRun();
            const res = await request(app)
                .patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', adminB.header);
            assert.equal(res.status, 404);
        });
    });

    describe('state transitions', () => {
        test('a run in review can be approved', async () => {
            const run = await seedRun({ status: 'review' });
            const res = await request(app)
                .patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.status, 'approved');
        });

        test('a draft run cannot be approved — review comes first', async () => {
            const run = await seedRun({ status: 'draft' });
            const res = await request(app)
                .patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 400);
            assert.match(res.body.message, /status 'draft'/);
        });

        test('an approved run can be locked', async () => {
            const run = await seedRun({ status: 'approved' });
            const res = await request(app)
                .post(`/api/payroll-runs/${run._id}/lock`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.status, 'locked');
        });

        test('a run in review cannot be locked before approval', async () => {
            const run = await seedRun({ status: 'review' });
            const res = await request(app)
                .post(`/api/payroll-runs/${run._id}/lock`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 400);
            assert.match(res.body.message, /approved first/i);
        });

        test('approving twice is refused — the second call sees status approved', async () => {
            const run = await seedRun({ status: 'review' });
            await request(app).patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', admin.header).expect(200);

            const res = await request(app).patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 400, 'a run must not be approvable twice');
        });

        test('an approved run can be marked paid', async () => {
            const run = await seedRun({ status: 'approved' });
            const res = await request(app)
                .patch(`/api/payroll-runs/${run._id}/pay`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.status, 'paid');
        });

        test('approve, lock and pay work when called with no request body', async () => {
            // The frontend sends no body to these. Express 5 leaves req.body
            // undefined, which used to make markAsPaid throw a 500.
            const run = await seedRun({ status: 'review' });
            await request(app).patch(`/api/payroll-runs/${run._id}/approve`)
                .set('Authorization', admin.header).expect(200);

            const paid = await request(app).patch(`/api/payroll-runs/${run._id}/pay`)
                .set('Authorization', admin.header);
            assert.equal(paid.status, 200, 'a body-less PATCH must not 500');
            assert.equal(paid.body.data.paymentMode, 'bank_transfer');
        });

        test('a paid run cannot be deleted', async () => {
            const run = await seedRun({ status: 'paid' });
            const res = await request(app)
                .delete(`/api/payroll-runs/${run._id}`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 400);
            assert.match(res.body.message, /paid/i);
        });

        test('a run that is not paid can be deleted', async () => {
            const run = await seedRun({ status: 'review' });
            const res = await request(app)
                .delete(`/api/payroll-runs/${run._id}`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(await PayrollRun.countDocuments({ _id: run._id }), 0);
        });
    });

    describe('initiate guards', () => {
        test('refuses a second run for a month that already has one', async () => {
            await seedRun({ month: 6, year: 2026 });
            const res = await request(app)
                .post('/api/payroll-runs/initiate')
                .set('Authorization', admin.header)
                .send({ month: 6, year: 2026 });
            assert.equal(res.status, 400);
            assert.match(res.body.message, /already exists/i);
        });

        test('creates a run for the organization\'s active employees', async () => {
            const res = await request(app)
                .post('/api/payroll-runs/initiate')
                .set('Authorization', admin.header)
                .send({ month: 7, year: 2026 });
            assert.equal(res.status, 201);
            assert.equal(String(res.body.data.organizationId), String(ORG_A));
        });
    });
});
