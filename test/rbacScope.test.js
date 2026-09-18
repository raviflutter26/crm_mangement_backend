const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const Organization = require('../src/models/Organization');
const Branch = require('../src/models/Branch');
const Department = require('../src/models/Department');
const ModulePermission = require('../src/models/ModulePermission');

/**
 * End-to-end cover for the role x scope model.
 *
 * utils/tenancy is unit-tested, but a unit test cannot show that a given route
 * actually applies it — these go through the real app so a controller that
 * forgets to scope is caught here rather than in production.
 */

const makeOrg = (name) => Organization.create({
    name, email: `${name.replace(/\W+/g, '')}@test.local`, industry: 'Manufacturing',
});

describe('Department routes: tenant and branch scoping', () => {
    let orgA, orgB, ooty, erode, otherBranch;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        orgA = await makeOrg('Nilgiris Industries');
        orgB = await makeOrg('Cauvery Technologies');
        ooty = await Branch.create({ name: 'Ooty', organizationId: orgA._id, state: 'Tamil Nadu', isDefault: true });
        erode = await Branch.create({ name: 'Erode', organizationId: orgA._id, state: 'Tamil Nadu' });
        otherBranch = await Branch.create({ name: 'Chennai', organizationId: orgB._id, state: 'Tamil Nadu', isDefault: true });

        await Department.create({ name: 'Engineering', organizationId: orgA._id, branchId: ooty._id });
        await Department.create({ name: 'Finance', organizationId: orgA._id, branchId: erode._id });
        await Department.create({ name: 'Engineering', organizationId: orgB._id, branchId: otherBranch._id });
    });

    test('a forged organizationId cannot reach another tenant', async () => {
        // The bug this pins: the filter was req.query.organizationId ||
        // req.user.organizationId, with no role check, so any signed-in user
        // could read any tenant by asking for it.
        const emp = await authFor({ role: 'employee', organizationId: orgA._id, branchId: ooty._id });
        const res = await request(app)
            .get(`/api/departments?organizationId=${orgB._id}`)
            .set('Authorization', emp.header);

        assert.equal(res.status, 200);
        const names = res.body.data.map(d => String(d.organizationId));
        assert.ok(names.every(id => id === String(orgA._id)),
            'a tenant user must never see another organization\'s departments');
    });

    test('a branch HR sees only their own branch', async () => {
        const hr = await authFor({ role: 'hr', organizationId: orgA._id, branchIds: [ooty._id], branchId: ooty._id });
        const res = await request(app).get('/api/departments').set('Authorization', hr.header);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.map(d => d.name), ['Engineering']);
    });

    test('an HR in one branch cannot see another branch, even in their own org', async () => {
        const hr = await authFor({ role: 'hr', organizationId: orgA._id, branchIds: [erode._id], branchId: erode._id });
        const res = await request(app).get('/api/departments').set('Authorization', hr.header);

        assert.equal(res.status, 200);
        assert.ok(!res.body.data.some(d => d.name === 'Engineering'),
            'Erode HR must not see the Ooty department');
    });

    test('an owner sees every branch in their organization', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        const res = await request(app).get('/api/departments').set('Authorization', owner.header);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 2);
    });

    test('an unassigned branch role sees nothing rather than everything', async () => {
        // The fail-open this closes: branchIds: [] reads as "every branch", so a
        // branch HR nobody had assigned yet was silently group-wide.
        const hr = await authFor({ role: 'hr', organizationId: orgA._id });
        const res = await request(app).get('/api/departments').set('Authorization', hr.header);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 0);
    });

    test('isGroupWide restores organization-wide visibility explicitly', async () => {
        const hr = await authFor({ role: 'hr', organizationId: orgA._id, isGroupWide: true });
        const res = await request(app).get('/api/departments').set('Authorization', hr.header);

        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 2);
    });

    test('creating a department stamps the caller\'s branch, not one they sent', async () => {
        const hr = await authFor({ role: 'hr', organizationId: orgA._id, branchIds: [ooty._id], branchId: ooty._id });
        const res = await request(app)
            .post('/api/departments')
            .set('Authorization', hr.header)
            .send({ name: 'Quality', branchId: String(erode._id) });

        assert.equal(res.status, 403, 'naming a branch you do not hold is a refusal, not a silent substitution');
    });

    test('a department is created into the branch the caller holds', async () => {
        const hr = await authFor({ role: 'hr', organizationId: orgA._id, branchIds: [ooty._id], branchId: ooty._id });
        const res = await request(app)
            .post('/api/departments')
            .set('Authorization', hr.header)
            .send({ name: 'Quality' });

        assert.equal(res.status, 201);
        assert.equal(String(res.body.data.branchId), String(ooty._id));
        assert.equal(String(res.body.data.organizationId), String(orgA._id));
    });
});

describe('Branch routes', () => {
    let orgA, orgB, ooty, erode, chennai;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        orgA = await makeOrg('Nilgiris Industries');
        orgB = await makeOrg('Cauvery Technologies');
        ooty = await Branch.create({ name: 'Ooty', organizationId: orgA._id, state: 'Tamil Nadu', isDefault: true });
        erode = await Branch.create({ name: 'Erode', organizationId: orgA._id, state: 'Tamil Nadu' });
        chennai = await Branch.create({ name: 'Chennai', organizationId: orgB._id, state: 'Tamil Nadu', isDefault: true });
    });

    test('rejects an unauthenticated request', async () => {
        const res = await request(app).get('/api/branches');
        assert.equal(res.status, 401);
    });

    test('lists only the branches the caller holds', async () => {
        const admin = await authFor({ role: 'admin', organizationId: orgA._id, branchIds: [ooty._id], branchId: ooty._id });
        const res = await request(app).get('/api/branches').set('Authorization', admin.header);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.map(b => b.name), ['Ooty']);
    });

    test('an owner lists every branch in their own organization only', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        const res = await request(app).get('/api/branches').set('Authorization', owner.header);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.map(b => b.name).sort(), ['Erode', 'Ooty']);
    });

    test('authorizeBranch refuses a branch the caller does not hold', async () => {
        const admin = await authFor({ role: 'admin', organizationId: orgA._id, branchIds: [ooty._id], branchId: ooty._id });
        const res = await request(app)
            .put(`/api/branches/${erode._id}`)
            .set('Authorization', admin.header)
            .send({ city: 'Erode' });

        assert.equal(res.status, 403);
    });

    test('a branch in another tenant is not reachable at all', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        const res = await request(app).get(`/api/branches/${chennai._id}`).set('Authorization', owner.header);

        assert.equal(res.status, 404);
    });

    test('only an owner may create a branch', async () => {
        const admin = await authFor({ role: 'admin', organizationId: orgA._id, isGroupWide: true });
        const res = await request(app)
            .post('/api/branches')
            .set('Authorization', admin.header)
            .send({ name: 'Coimbatore', state: 'Tamil Nadu' });

        assert.equal(res.status, 403, 'a branch admin creating branches could mint itself new scope');
    });

    test('an owner creates a branch into their own organization', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        const res = await request(app)
            .post('/api/branches')
            .set('Authorization', owner.header)
            .send({ name: 'Coimbatore', state: 'Tamil Nadu', organizationId: String(orgB._id) });

        assert.equal(res.status, 201);
        assert.equal(String(res.body.data.organizationId), String(orgA._id),
            'a forged organizationId in the body must be stripped');
    });

    test('refuses to deactivate a branch that still has people', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        await authFor({ role: 'employee', organizationId: orgA._id, branchId: erode._id });

        const res = await request(app).delete(`/api/branches/${erode._id}`).set('Authorization', owner.header);
        assert.equal(res.status, 409);
    });

    test('refuses to deactivate the default branch', async () => {
        const owner = await authFor({ role: 'owner', organizationId: orgA._id });
        const res = await request(app).delete(`/api/branches/${ooty._id}`).set('Authorization', owner.header);
        assert.equal(res.status, 409);
    });
});

describe('Module grants (ModulePermission enforcement)', () => {
    let org, branch;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        org = await makeOrg('Nilgiris Industries');
        branch = await Branch.create({ name: 'Ooty', organizationId: org._id, isDefault: true });
    });

    test('no grant row leaves access exactly as it was', async () => {
        const hr = await authFor({ role: 'hr', organizationId: org._id, branchIds: [branch._id], branchId: branch._id });
        const res = await request(app).get('/api/departments').set('Authorization', hr.header);
        assert.equal(res.status, 200);
    });

    test('a grant that excludes the role denies the module', async () => {
        await ModulePermission.create({ organizationId: org._id, module: 'departments', roles: ['admin'] });
        const hr = await authFor({ role: 'hr', organizationId: org._id, branchIds: [branch._id], branchId: branch._id });

        const res = await request(app).get('/api/departments').set('Authorization', hr.header);
        assert.equal(res.status, 403);
    });

    test('matches roles case-insensitively against legacy rows', async () => {
        // Rows were seeded as 'Admin'/'HR' while User.role is lowercase, so a
        // naive comparison matched nothing and would have denied everyone.
        await ModulePermission.collection.insertOne({
            organizationId: org._id, module: 'departments', roles: ['Admin', 'HR'],
        });
        const hr = await authFor({ role: 'hr', organizationId: org._id, branchIds: [branch._id], branchId: branch._id });

        const res = await request(app).get('/api/departments').set('Authorization', hr.header);
        assert.equal(res.status, 200);
    });

    test('an owner is never locked out by a module grant', async () => {
        await ModulePermission.create({ organizationId: org._id, module: 'departments', roles: ['admin'] });
        const owner = await authFor({ role: 'owner', organizationId: org._id });

        const res = await request(app).get('/api/departments').set('Authorization', owner.header);
        assert.equal(res.status, 200, 'the owner edits these grants and must not be able to lock themselves out');
    });

    test('the model lowercases roles on write', async () => {
        const row = await ModulePermission.create({
            organizationId: org._id, module: 'payroll', roles: ['Admin', 'HR'],
        });
        assert.deepEqual(row.roles, ['admin', 'hr']);
    });
});

/**
 * The department leak was not isolated: the same
 * `req.query.organizationId || req.user.organizationId` pattern sat on three
 * more organization endpoints, each reachable by any authenticated user with no
 * role guard. These pin all of them.
 */
describe('Organization sub-resources: no cross-tenant reads', () => {
    let orgA, orgB;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        orgA = await makeOrg('Nilgiris Industries');
        orgB = await makeOrg('Cauvery Technologies');

        await Branch.create({ name: 'Ooty', organizationId: orgA._id, isDefault: true });
        await Branch.create({ name: 'Chennai', organizationId: orgB._id, isDefault: true });

        const Designation = require('../src/models/Designation');
        const Holiday = require('../src/models/Holiday');
        await Designation.create({ name: 'Fitter', organizationId: orgA._id });
        await Designation.create({ name: 'Analyst', organizationId: orgB._id });
        // getHolidays defaults to the current year, so the fixtures have to land
        // in it rather than a hard-coded one.
        const thisYear = new Date().getFullYear();
        await Holiday.create({ name: 'Pongal', date: new Date(thisYear, 0, 15), year: thisYear, organizationId: orgA._id });
        await Holiday.create({ name: 'Diwali', date: new Date(thisYear, 10, 8), year: thisYear, organizationId: orgB._id });
    });

    const cases = [
        { path: '/api/organizations/designations', label: 'designations' },
        { path: '/api/organizations/branches', label: 'branches' },
        { path: '/api/organizations/holidays', label: 'holidays' },
    ];

    for (const { path, label } of cases) {
        test(`${label}: a forged organizationId is ignored`, async () => {
            const emp = await authFor({ role: 'employee', organizationId: orgA._id });
            const res = await request(app).get(`${path}?organizationId=${orgB._id}`).set('Authorization', emp.header);

            assert.equal(res.status, 200);
            const foreign = res.body.data.filter(d => String(d.organizationId) !== String(orgA._id));
            assert.equal(foreign.length, 0, `${label} leaked ${foreign.length} row(s) from another tenant`);
        });

        test(`${label}: a caller sees their own tenant's rows`, async () => {
            const emp = await authFor({ role: 'employee', organizationId: orgA._id });
            const res = await request(app).get(path).set('Authorization', emp.header);

            assert.equal(res.status, 200);
            assert.ok(res.body.data.length > 0, `${label} returned nothing for its own tenant`);
        });
    }
});

/**
 * Routes that an employee could reach before the route-contract sweep.
 *
 * Each of these was authenticated but carried no role guard, so any signed-in
 * employee could call it. They are grouped here because the failure mode is the
 * same in every case: authentication was mistaken for authorization.
 */
describe('Privilege escalation: employee cannot reach staff-only routes', () => {
    let org, branch, employee, hr;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        org = await makeOrg('Nilgiris Industries');
        branch = await Branch.create({ name: 'Ooty', organizationId: org._id, isDefault: true });
        employee = await authFor({ role: 'employee', organizationId: org._id, branchId: branch._id });
        hr = await authFor({ role: 'hr', organizationId: org._id, branchIds: [branch._id], branchId: branch._id });
    });

    const denied = [
        ['GET',    '/api/payroll/summary'],
        ['GET',    '/api/payroll/audit-logs'],
        ['GET',    '/api/payroll/attendance-summary'],
        ['GET',    '/api/payroll-runs'],
        ['GET',    '/api/salary-components'],
        ['POST',   '/api/salary-components'],
        ['POST',   '/api/salary-components/seed'],
        ['GET',    '/api/salary-structures'],
        ['GET',    '/api/statutory/config'],
        ['GET',    '/api/invitations'],
        ['GET',    '/api/employees'],
        ['GET',    '/api/employees/stats'],
        ['POST',   '/api/assets'],
        ['POST',   '/api/performance/appraisals'],
        ['GET',    '/api/tax-documents'],
        ['GET',    '/api/employee-documents'],
    ];

    for (const [method, path] of denied) {
        test(`${method} ${path} is refused`, async () => {
            const res = await request(app)[method.toLowerCase()](path)
                .set('Authorization', employee.header)
                .send({});
            assert.equal(res.status, 403, `${method} ${path} should refuse an employee, got ${res.status}`);
        });
    }

    test('an employee cannot approve an expense', async () => {
        const Expense = require('../src/models/Expense');
        const exp = await Expense.create({
            employee: employee.user._id, organizationId: org._id, title: 'Taxi', amount: 400,
        });

        const res = await request(app)
            .patch(`/api/expenses/${exp._id}/status`)
            .set('Authorization', employee.header)
            .send({ status: 'approved' });

        assert.equal(res.status, 403, 'approving your own expense is the thing this must not allow');
    });

    test('an employee cannot read a colleague\'s payslip', async () => {
        const colleague = await authFor({ role: 'employee', organizationId: org._id, branchId: branch._id });
        const res = await request(app)
            .get(`/api/payroll/payslip/${colleague.user._id}/run-1`)
            .set('Authorization', employee.header);

        assert.equal(res.status, 403);
    });

    test('an employee cannot read a colleague\'s statutory details', async () => {
        const colleague = await authFor({ role: 'employee', organizationId: org._id, branchId: branch._id });
        const res = await request(app)
            .get(`/api/statutory/employee/${colleague.user._id}`)
            .set('Authorization', employee.header);

        assert.equal(res.status, 403);
    });

    test('an employee cannot read a colleague\'s leave balance', async () => {
        const colleague = await authFor({ role: 'employee', organizationId: org._id, branchId: branch._id });
        const res = await request(app)
            .get(`/api/leaves/balance/${colleague.user._id}`)
            .set('Authorization', employee.header);

        assert.equal(res.status, 403);
    });

    test('HR still reaches the staff routes an employee cannot', async () => {
        const res = await request(app).get('/api/salary-components').set('Authorization', hr.header);
        assert.equal(res.status, 200, 'the sweep must not have locked HR out of its own screens');
    });

    test('the organization list never spans tenants', async () => {
        const other = await makeOrg('Cauvery Technologies');
        const res = await request(app).get('/api/organizations').set('Authorization', hr.header);

        assert.equal(res.status, 200);
        const ids = (res.body.data || []).map(o => String(o._id));
        assert.ok(!ids.includes(String(other._id)),
            'the platform customer list was readable by any authenticated tenant user');
    });
});
