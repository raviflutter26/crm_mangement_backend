const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor, makeUser } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');
const Leave = require('../src/models/Leave');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/**
 * The dashboard aggregates across many collections at once, which makes it the
 * single most likely place for a missing tenant filter to go unnoticed — a
 * stray count is far less visible than a stray row in a table.
 */
describe('Dashboard API', () => {
    let adminA, adminB;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        adminA = await authFor({ role: 'admin', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
    });

    for (const path of ['/api/dashboard', '/api/dashboard/analytics']) {
        describe(path, () => {
            test('requires authentication', async () => {
                assert.equal((await request(app).get(path)).status, 401);
            });

            test('rejects a forged token', async () => {
                const res = await request(app).get(path).set('Authorization', 'Bearer forged');
                assert.equal(res.status, 401);
            });

            test('responds for an authenticated admin', async () => {
                const res = await request(app).get(path).set('Authorization', adminA.header);
                assert.equal(res.status, 200, `${path} should succeed`);
                assert.equal(res.body.success, true);
                assert.ok(res.body.data, 'a data payload is expected');
            });

            test('responds for an organization with no data at all', async () => {
                // An empty tenant must produce zeroes, not a crash.
                const res = await request(app).get(path).set('Authorization', adminB.header);
                assert.equal(res.status, 200);
            });
        });
    }

    describe('tenant scoping of counts', () => {
        beforeEach(async () => {
            const empA = await makeUser({ role: 'employee', organizationId: ORG_A });
            const empB = await makeUser({ role: 'employee', organizationId: ORG_B });

            await Project.create([
                { name: 'A1', organizationId: ORG_A, status: 'In Progress' },
                { name: 'A2', organizationId: ORG_A, status: 'Completed' },
                { name: 'B1', organizationId: ORG_B, status: 'In Progress' },
            ]);
            await Leave.create([
                { employee: empA._id, organizationId: ORG_A, leaveType: 'Casual Leave', status: 'Pending',
                  startDate: new Date(), endDate: new Date(), totalDays: 1, reason: 'x' },
                { employee: empB._id, organizationId: ORG_B, leaveType: 'Casual Leave', status: 'Pending',
                  startDate: new Date(), endDate: new Date(), totalDays: 1, reason: 'x' },
            ]);
        });

        test('the dashboard does not count another organization\'s rows', async () => {
            const a = await request(app).get('/api/dashboard').set('Authorization', adminA.header);
            const b = await request(app).get('/api/dashboard').set('Authorization', adminB.header);

            assert.equal(a.status, 200);
            assert.equal(b.status, 200);

            // Whatever the exact shape, the two tenants must not agree on totals
            // that we deliberately made different.
            assert.notDeepEqual(a.body.data, b.body.data,
                'both organizations returned identical dashboards, which suggests an unscoped query');
        });

        test('analytics responds with data seeded for the caller', async () => {
            const res = await request(app).get('/api/dashboard/analytics').set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.ok(res.body.data);
        });
    });
});
