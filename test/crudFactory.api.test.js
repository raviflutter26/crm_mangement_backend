const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Project = require('../src/models/Project');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

/**
 * crudFactory backs fifteen modules, so its create/read/update/delete paths are
 * exercised once here through /api/projects rather than repeated per module.
 * The contract sweep in moduleContract.test.js already proves each module is
 * wired to the same scoping; this covers what that shared code then does.
 */
describe('crudFactory behaviour (via /api/projects)', () => {
    let admin, adminB, employee;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        admin = await authFor({ role: 'admin', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
        employee = await authFor({ role: 'employee', organizationId: ORG_A });
    });

    const create = (auth, body = { name: 'Bridge Works', budget: 500000 }) =>
        request(app).post('/api/projects').set('Authorization', auth.header).send(body);

    describe('create', () => {
        test('an admin can create, and the row is stamped with their organization', async () => {
            const res = await create(admin);
            assert.equal(res.status, 201);
            assert.equal(res.body.data.name, 'Bridge Works');
            assert.equal(String(res.body.data.organizationId), String(ORG_A));
        });

        test('an employee cannot create', async () => {
            assert.equal((await create(employee)).status, 403);
        });

        test('a client-supplied organizationId is overwritten, not honoured', async () => {
            const res = await create(admin, { name: 'Forged', organizationId: ORG_B.toString() });
            assert.equal(res.status, 201);
            assert.equal(String(res.body.data.organizationId), String(ORG_A));
        });

        test('a missing required field is a 400, not a 500', async () => {
            const res = await create(admin, { budget: 1 });
            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
        });
    });

    describe('read one', () => {
        test('returns a row from the caller\'s organization', async () => {
            const created = await create(admin);
            const res = await request(app)
                .get(`/api/projects/${created.body.data._id}`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.name, 'Bridge Works');
        });

        test("404s for another organization's row", async () => {
            const created = await create(admin);
            const res = await request(app)
                .get(`/api/projects/${created.body.data._id}`)
                .set('Authorization', adminB.header);
            assert.equal(res.status, 404);
        });

        test('404s for an id that does not exist', async () => {
            const res = await request(app)
                .get(`/api/projects/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 404);
        });

        test('a malformed id is handled, not thrown', async () => {
            const res = await request(app).get('/api/projects/not-an-objectid')
                .set('Authorization', admin.header);
            assert.ok([400, 404, 500].includes(res.status), `unexpected status ${res.status}`);
            assert.equal(res.body.success, false);
        });
    });

    describe('update', () => {
        test('an admin can update their own row', async () => {
            const created = await create(admin);
            const res = await request(app)
                .put(`/api/projects/${created.body.data._id}`)
                .set('Authorization', admin.header)
                .send({ name: 'Renamed', progress: 40 });
            assert.equal(res.status, 200);
            assert.equal(res.body.data.name, 'Renamed');
            assert.equal(res.body.data.progress, 40);
        });

        test("cannot update another organization's row", async () => {
            const created = await create(admin);
            const res = await request(app)
                .put(`/api/projects/${created.body.data._id}`)
                .set('Authorization', adminB.header)
                .send({ name: 'Hijacked' });
            assert.equal(res.status, 404);

            const untouched = await Project.findById(created.body.data._id);
            assert.equal(untouched.name, 'Bridge Works');
        });

        test('an update cannot move a row to another organization', async () => {
            const created = await create(admin);
            await request(app)
                .put(`/api/projects/${created.body.data._id}`)
                .set('Authorization', admin.header)
                .send({ organizationId: ORG_B.toString(), name: 'Still Ours' })
                .expect(200);

            const row = await Project.findById(created.body.data._id);
            assert.equal(String(row.organizationId), String(ORG_A), 'tenant key must be immutable via update');
        });

        test('an invalid value is a 400', async () => {
            const created = await create(admin);
            const res = await request(app)
                .put(`/api/projects/${created.body.data._id}`)
                .set('Authorization', admin.header)
                .send({ status: 'NotAValidStatus' });
            assert.equal(res.status, 400);
        });
    });

    describe('delete', () => {
        test('an admin can delete their own row', async () => {
            const created = await create(admin);
            const res = await request(app)
                .delete(`/api/projects/${created.body.data._id}`)
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(await Project.countDocuments({ _id: created.body.data._id }), 0);
        });

        test("cannot delete another organization's row", async () => {
            const created = await create(admin);
            const res = await request(app)
                .delete(`/api/projects/${created.body.data._id}`)
                .set('Authorization', adminB.header);
            assert.equal(res.status, 404);
            assert.equal(await Project.countDocuments({ _id: created.body.data._id }), 1);
        });

        test('an employee cannot delete', async () => {
            const created = await create(admin);
            const res = await request(app)
                .delete(`/api/projects/${created.body.data._id}`)
                .set('Authorization', employee.header);
            assert.equal(res.status, 403);
        });
    });

    describe('list filters', () => {
        test('filters by status within the caller\'s organization', async () => {
            await create(admin, { name: 'A', status: 'Completed' });
            await create(admin, { name: 'B', status: 'Planning' });

            const res = await request(app).get('/api/projects?status=Completed')
                .set('Authorization', admin.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.length, 1);
            assert.equal(res.body.data[0].name, 'A');
        });

        test('reports a count alongside the rows', async () => {
            await create(admin, { name: 'A' });
            await create(admin, { name: 'B' });
            const res = await request(app).get('/api/projects').set('Authorization', admin.header);
            assert.equal(res.body.count, 2);
        });
    });
});
