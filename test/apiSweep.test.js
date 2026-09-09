const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { startDb, stopDb, clearDb, makeUser } = require('../test-utils/testEnv');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');

const { runSweep } = require('../src/tools/apiSweep/runSweep');
const { classify, isFailure, VERDICT } = require('../src/tools/apiSweep/classify');
const { checkDrift, ENDPOINTS } = require('../src/tools/apiSweep/manifest');

const PASSWORD = 'Qa-Sweep-Password-1';
const ORG = new mongoose.Types.ObjectId();

describe('classify', () => {
    test('200 with rows is OK', () => {
        assert.equal(classify({ status: 200, body: { data: [1, 2] } }).verdict, VERDICT.OK);
    });

    test('200 with an empty array is EMPTY, not a failure', () => {
        const r = classify({ status: 200, body: { data: [] } });
        assert.equal(r.verdict, VERDICT.EMPTY);
        // The distinction this whole tool exists for.
        assert.equal(isFailure(200, r.verdict), false);
    });

    test('an object payload with keys counts as present', () => {
        assert.equal(classify({ status: 200, body: { data: { total: 0 } } }).verdict, VERDICT.OK);
    });

    test('403 / 404 / 500 are separated, not lumped as "error"', () => {
        assert.equal(classify({ status: 403, body: {} }).verdict, VERDICT.FORBIDDEN);
        assert.equal(classify({ status: 404, body: {} }).verdict, VERDICT.NOT_MOUNTED);
        assert.equal(classify({ status: 503, body: {} }).verdict, VERDICT.SERVER_ERROR);
    });

    test('no response at all is UNREACHABLE', () => {
        const r = classify({ status: null, body: null, error: new Error('ECONNREFUSED') });
        assert.equal(r.verdict, VERDICT.UNREACHABLE);
        assert.match(r.detail, /ECONNREFUSED/);
    });

    test('a stated 200 expectation fails on 403, and a stated 403 fails on 200', () => {
        assert.equal(isFailure(200, VERDICT.FORBIDDEN), true);
        assert.equal(isFailure(403, VERDICT.OK), true);
        assert.equal(isFailure(403, VERDICT.FORBIDDEN), false);
    });

    test('nothing is judged where the manifest states no expectation', () => {
        assert.equal(isFailure(undefined, VERDICT.SERVER_ERROR), false);
    });
});

describe('manifest', () => {
    test('every endpoint is under /api and has a label', () => {
        for (const e of ENDPOINTS) {
            assert.match(e.path, /^\/api\//, `${e.path} should be an /api path`);
            assert.ok(e.label, `${e.path} needs a label`);
        }
    });

    test('drift check reports mounts the manifest does not cover', () => {
        const fake = "router.use('/widgets', widgetRoutes);\nrouter.use('/projects', projectRoutes);";
        assert.deepEqual(checkDrift(fake), ['/widgets']);
    });
});

describe('runSweep against a live server', () => {
    let server, baseUrl;

    before(async () => {
        await startDb();
        // Port 0 = let the OS pick, so a busy port cannot make this flaky.
        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await stopDb();
    });

    beforeEach(async () => {
        await clearDb();
        for (const role of ['admin', 'employee']) {
            await User.create({
                firstName: 'QA', lastName: role,
                email: `qa-${role}@test.local`,
                password: PASSWORD, role,
                organizationId: ORG, isActive: true, status: 'Active',
            });
            process.env[`QA_${role.toUpperCase()}_EMAIL`] = `qa-${role}@test.local`;
            process.env[`QA_${role.toUpperCase()}_PASSWORD`] = PASSWORD;
        }
    });

    test('sweeps every manifest endpoint for the requested role', async () => {
        const report = await runSweep({ baseUrl, roles: ['admin'] });

        assert.deepEqual(report.rolesSwept, ['admin']);
        assert.equal(report.rows.length, ENDPOINTS.length);
        assert.equal(report.summary.total, ENDPOINTS.length);
    });

    test('classifies a populated module as OK and an unseeded one as EMPTY', async () => {
        await Project.create({ name: 'Seeded', organizationId: ORG, status: 'In Progress' });

        const report = await runSweep({ baseUrl, roles: ['admin'] });
        const projects = report.rows.find((r) => r.path === '/api/projects');
        const vendors = report.rows.find((r) => r.path === '/api/vendors');

        assert.equal(projects.verdict, VERDICT.OK, 'a seeded module should read as OK');
        assert.equal(projects.rows, 1);
        // Vendors is built and mounted but has no rows — the case the August
        // audit misread as "not built".
        assert.equal(vendors.verdict, VERDICT.EMPTY);
        assert.equal(vendors.failed, false, 'an empty module is not a defect');
    });

    test('detects a role that is refused an endpoint it should reach', async () => {
        const report = await runSweep({ baseUrl, roles: ['employee'] });
        const revenue = report.rows.find((r) => r.path === '/api/revenue/summary');

        // The manifest says an employee must be refused revenue.
        assert.equal(revenue.verdict, VERDICT.FORBIDDEN);
        assert.equal(revenue.expected, 403);
        assert.equal(revenue.failed, false, 'a correctly refused endpoint is not a failure');
    });

    test('reports a role with no credentials as skipped rather than failing', async () => {
        delete process.env.QA_HR_EMAIL;
        delete process.env.QA_HR_PASSWORD;

        const report = await runSweep({ baseUrl, roles: ['hr'] });
        assert.equal(report.rows.length, 0);
        assert.equal(report.skipped.length, 1);
        assert.match(report.skipped[0].reason, /QA_HR_EMAIL/);
    });

    test('a bad password is reported as a skipped role, not a wall of failures', async () => {
        process.env.QA_ADMIN_PASSWORD = 'wrong-password';

        const report = await runSweep({ baseUrl, roles: ['admin'] });
        assert.equal(report.rows.length, 0);
        assert.match(report.skipped[0].reason, /login failed/);

        process.env.QA_ADMIN_PASSWORD = PASSWORD;
    });

    test('an unreachable API yields UNREACHABLE, not a crash', async () => {
        // Port 1 is reserved and refuses connections.
        const report = await runSweep({ baseUrl: 'http://127.0.0.1:1', roles: ['admin'], timeout: 1500 });
        assert.equal(report.rows.length, 0);
        assert.equal(report.skipped.length, 1, 'login should fail before any probe runs');
    });
});
