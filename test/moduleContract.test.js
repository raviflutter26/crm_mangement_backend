const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/**
 * Every module below is scoped by the same mechanism (crudFactory's scopeFilter,
 * or utils/tenancy). utils/tenancy is unit-tested, but that proves nothing about
 * whether a given route actually applies it — only a real request can show that.
 * This sweep asserts the contract once per module rather than trusting the shared
 * helper to have been wired in correctly everywhere.
 */
const MODULES = [
    { mount: '/api/projects', model: 'Project' },
    { mount: '/api/vendors', model: 'Vendor' },
    { mount: '/api/job-cards', model: 'JobCard' },
    { mount: '/api/travel-requests', model: 'TravelRequest' },
    { mount: '/api/incidents', model: 'Incident' },
    { mount: '/api/ppe-records', model: 'PPERecord' },
    { mount: '/api/reimbursements', model: 'Reimbursement' },
    { mount: '/api/site-allowances', model: 'SiteAllowance' },
    { mount: '/api/trainings', model: 'Training' },
    { mount: '/api/certifications', model: 'Certification' },
    { mount: '/api/announcements', model: 'Announcement' },
    { mount: '/api/employee-documents', model: 'EmployeeDocument' },
    { mount: '/api/timesheets', model: 'Timesheet' },
    { mount: '/api/skills', model: 'Skill' },
    { mount: '/api/ip-allowlist', model: 'IpAllowlistEntry' },
];

// Ensure every model is registered before its collection name is read.
for (const m of MODULES) require(`../src/models/${m.model}`);

/**
 * Insert straight into the collection, bypassing schema validation.
 *
 * The point here is the tenant filter, not each model's required fields —
 * building a valid fixture for fifteen unrelated schemas would add a lot of
 * noise and couple this sweep to every one of them.
 */
const seed = async (modelName, organizationId) => {
    const coll = mongoose.model(modelName).collection;
    await coll.insertOne({ organizationId, isActive: true, createdAt: new Date() });
};

describe('Module contract: auth and tenant scoping', () => {
    let adminA, adminB;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        adminA = await authFor({ role: 'admin', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
    });

    for (const { mount, model } of MODULES) {
        describe(mount, () => {
            test('rejects an unauthenticated list request', async () => {
                const res = await request(app).get(mount);
                assert.equal(res.status, 401, `${mount} must require authentication`);
            });

            test('rejects a forged token', async () => {
                const res = await request(app).get(mount).set('Authorization', 'Bearer forged.token.value');
                assert.equal(res.status, 401);
            });

            test('returns only the caller\'s organization', async () => {
                await seed(model, ORG_A);
                await seed(model, ORG_B);
                await seed(model, ORG_B);

                const res = await request(app).get(mount).set('Authorization', adminA.header);
                assert.equal(res.status, 200, `${mount} list should succeed for an admin`);
                assert.equal(res.body.data.length, 1, `${mount} leaked rows across tenants`);
                assert.equal(String(res.body.data[0].organizationId), String(ORG_A));
            });

            test('a client-supplied organizationId cannot widen the query', async () => {
                await seed(model, ORG_A);
                await seed(model, ORG_B);

                // A tenant admin asking for another org must still get only their own.
                const res = await request(app)
                    .get(`${mount}?organizationId=${ORG_B}`)
                    .set('Authorization', adminA.header);
                assert.equal(res.status, 200);
                assert.equal(res.body.data.length, 1, `${mount} honoured a client-supplied organizationId`);
                assert.equal(String(res.body.data[0].organizationId), String(ORG_A));
            });
        });
    }
});
