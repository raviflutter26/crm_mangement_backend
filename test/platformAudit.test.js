const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb } = require('../test-utils/testEnv');
const mongoose = require('mongoose');

const AuditLog = require('../src/models/AuditLog');
const { recordPlatformAccess } = require('../src/middleware/platformAudit');

/**
 * A superadmin bypasses every role check and every tenant filter. These cover
 * the trail that makes that access answerable after the fact.
 */
describe('recordPlatformAccess', () => {
    const ORG = new mongoose.Types.ObjectId();
    const SUPER = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    const req = (overrides = {}) => ({
        user: { _id: SUPER, role: 'superadmin', email: 'root@platform.local' },
        method: 'GET',
        originalUrl: '/api/payroll',
        query: {},
        body: {},
        ip: '203.0.113.9',
        headers: { 'user-agent': 'jest/test' },
        ...overrides,
    });

    test('records a superadmin reaching into a named tenant', async () => {
        await recordPlatformAccess(req({ query: { organizationId: String(ORG) } }));

        const entries = await AuditLog.find({});
        assert.equal(entries.length, 1);
        assert.equal(String(entries[0].organizationId), String(ORG));
        assert.equal(String(entries[0].userId), String(SUPER));
        assert.equal(entries[0].module, 'Platform Access');
        assert.equal(entries[0].action, 'GET /api/payroll');
        assert.equal(entries[0].details.reach, 'single-tenant');
        assert.equal(entries[0].details.write, false);
    });

    test('flags a request that was not narrowed to one tenant', async () => {
        // Reading with no organizationId reads across every customer, which is
        // broader than targeting one and is the case most worth seeing later.
        await recordPlatformAccess(req());

        const [entry] = await AuditLog.find({});
        assert.equal(entry.organizationId, null);
        assert.equal(entry.details.reach, 'all-tenants');
    });

    test('marks writes as writes', async () => {
        await recordPlatformAccess(req({ method: 'PATCH', body: { organizationId: String(ORG) } }));
        const [entry] = await AuditLog.find({});
        assert.equal(entry.details.write, true);
        assert.equal(String(entry.organizationId), String(ORG));
    });

    test('captures ip and user agent', async () => {
        await recordPlatformAccess(req());
        const [entry] = await AuditLog.find({});
        assert.equal(entry.ipAddress, '203.0.113.9');
        assert.equal(entry.userAgent, 'jest/test');
    });

    test('ignores everyone who is not a superadmin', async () => {
        for (const role of ['owner', 'admin', 'hr', 'manager', 'employee']) {
            await recordPlatformAccess(req({
                user: { _id: new mongoose.Types.ObjectId(), role, organizationId: ORG },
            }));
        }
        assert.equal(await AuditLog.countDocuments({}), 0);
    });

    test('is case-insensitive about the role', async () => {
        await recordPlatformAccess(req({ user: { _id: SUPER, role: 'SuperAdmin' } }));
        assert.equal(await AuditLog.countDocuments({}), 1);
    });

    test('does not log the platform reading its own console', async () => {
        // Otherwise routine dashboard traffic buries the entries that matter.
        for (const url of ['/api/superadmin/analytics', '/api/organizations', '/api/auth/me']) {
            await recordPlatformAccess(req({ originalUrl: url }));
        }
        assert.equal(await AuditLog.countDocuments({}), 0);
    });

    test('still logs a write to a platform route', async () => {
        await recordPlatformAccess(req({ method: 'POST', originalUrl: '/api/organizations' }));
        const [entry] = await AuditLog.find({});
        assert.equal(entry.action, 'POST /api/organizations');
        assert.equal(entry.details.write, true);
    });

    test('matches console prefixes against the start of the path only', async () => {
        // A tenant route must not escape auditing by mentioning a platform
        // prefix further along the URL.
        await recordPlatformAccess(req({ originalUrl: '/api/payroll?next=/api/superadmin' }));
        assert.equal(await AuditLog.countDocuments({}), 1);
    });
});

describe('logAction tenant attribution', () => {
    const ORG = new mongoose.Types.ObjectId();
    const USER = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    const { logAction } = require('../src/utils/auditLogger');

    test('attributes the entry to the caller\'s organization', async () => {
        await logAction(USER, 'Leave Approved', 'Leaves', {}, {
            user: { organizationId: ORG }, ip: '1.2.3.4', headers: {},
        });
        const [entry] = await AuditLog.find({});
        assert.equal(String(entry.organizationId), String(ORG));
    });

    test('attributes a superadmin action to the tenant they named', async () => {
        await logAction(USER, 'Payroll Run', 'Payroll', {}, {
            user: { role: 'superadmin' }, query: { organizationId: String(ORG) }, headers: {},
        });
        const [entry] = await AuditLog.find({});
        assert.equal(String(entry.organizationId), String(ORG));
    });

    test('still writes an entry when there is no request to read', async () => {
        await logAction(USER, 'Cron Ran', 'System', { n: 1 });
        const [entry] = await AuditLog.find({});
        assert.equal(entry.organizationId, null);
        assert.equal(entry.action, 'Cron Ran');
    });
});
