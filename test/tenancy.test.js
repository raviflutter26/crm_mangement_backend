const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isSuperAdmin, scopeFilter, orgIdFor, withOrg, requireOrg, requireOwnOrg } = require('../src/utils/tenancy');

const ORG_A = '650000000000000000000001';
const ORG_B = '650000000000000000000002';

const asAdmin = (overrides = {}) => ({
    user: { role: 'admin', organizationId: ORG_A },
    query: {},
    body: {},
    ...overrides,
});

const asSuperAdmin = (overrides = {}) => ({
    user: { role: 'superadmin' },
    query: {},
    body: {},
    ...overrides,
});

// Minimal res double capturing status/json
const resDouble = () => {
    const res = { statusCode: null, payload: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (p) => { res.payload = p; return res; };
    return res;
};

describe('isSuperAdmin', () => {
    test('is case-insensitive, matching the role enum which allows both casings', () => {
        assert.equal(isSuperAdmin({ user: { role: 'superadmin' } }), true);
        assert.equal(isSuperAdmin({ user: { role: 'SuperAdmin' } }), true);
        assert.equal(isSuperAdmin({ user: { role: 'admin' } }), false);
        assert.equal(isSuperAdmin({ user: { role: 'Admin' } }), false);
    });

    test('an absent user is not a superadmin', () => {
        assert.equal(isSuperAdmin({}), false);
        assert.equal(isSuperAdmin({ user: {} }), false);
    });
});

describe('scopeFilter', () => {
    test('confines a tenant user to their own organization', () => {
        assert.deepEqual(scopeFilter(asAdmin()), { organizationId: ORG_A });
    });

    test('ignores a client-supplied organizationId for a tenant user', () => {
        const req = asAdmin({ query: { organizationId: ORG_B } });
        assert.deepEqual(scopeFilter(req), { organizationId: ORG_A });
    });

    test('a superadmin reads across tenants by default', () => {
        assert.deepEqual(scopeFilter(asSuperAdmin()), {});
    });

    test('a superadmin may target one organization', () => {
        const req = asSuperAdmin({ query: { organizationId: ORG_B } });
        assert.deepEqual(scopeFilter(req), { organizationId: ORG_B });
    });

    test('a user with no organization fails closed, never match-all', () => {
        // An undefined value would be dropped or coerced to null by the driver,
        // widening the read to every tenant. $in: [] can never match.
        const req = { user: { role: 'admin' }, query: {} };
        assert.deepEqual(scopeFilter(req), { _id: { $in: [] } });
    });

    test('a null organizationId also fails closed', () => {
        // User.organizationId defaults to null, so this case is reachable.
        const req = { user: { role: 'admin', organizationId: null }, query: {} };
        assert.deepEqual(scopeFilter(req), { _id: { $in: [] } });
    });

    test('the fail-closed filter is a fresh object each call', () => {
        // Handlers spread and mutate the result, so a shared frozen object
        // would throw or leak state between requests.
        const a = scopeFilter({ user: { role: 'admin' }, query: {} });
        const b = scopeFilter({ user: { role: 'admin' }, query: {} });
        assert.notEqual(a, b);
        a.extra = 1; // must not throw
        assert.equal(b.extra, undefined);
    });
});

describe('withOrg', () => {
    test('overwrites a forged organizationId in the body', () => {
        const req = asAdmin();
        const out = withOrg(req, { name: 'Structure', organizationId: ORG_B });
        assert.equal(out.organizationId, ORG_A);
        assert.equal(out.name, 'Structure');
    });

    test('strips the legacy companyId tenant key', () => {
        const out = withOrg(asAdmin(), { companyId: ORG_B, epf: {} });
        assert.equal(out.companyId, undefined);
        assert.equal(out.organizationId, ORG_A);
    });

    test('does not mutate the caller\'s payload', () => {
        const payload = { name: 'x', organizationId: ORG_B };
        withOrg(asAdmin(), payload);
        assert.equal(payload.organizationId, ORG_B, 'input object must be untouched');
    });

    test('a superadmin may set the organization explicitly', () => {
        const req = asSuperAdmin({ body: { organizationId: ORG_B } });
        const out = withOrg(req, { organizationId: ORG_B, name: 'x' });
        assert.equal(out.organizationId, ORG_B);
    });
});

describe('requireOrg', () => {
    test('returns the organization for a tenant user', () => {
        assert.equal(requireOrg(asAdmin(), resDouble()), ORG_A);
    });

    test('rejects with 400 when there is no organization context', () => {
        const res = resDouble();
        const out = requireOrg({ user: { role: 'admin' }, body: {}, query: {} }, res);
        assert.equal(out, null);
        assert.equal(res.statusCode, 400);
        assert.equal(res.payload.success, false);
    });
});

describe('requireOwnOrg', () => {
    test('allows a tenant user to act on their own organization', () => {
        assert.equal(requireOwnOrg(asAdmin(), resDouble(), ORG_A), ORG_A);
    });

    test('rejects a tenant user targeting another organization with 403', () => {
        const res = resDouble();
        const out = requireOwnOrg(asAdmin(), res, ORG_B);
        assert.equal(out, null);
        assert.equal(res.statusCode, 403);
    });

    test('allows a superadmin to act on any organization', () => {
        assert.equal(requireOwnOrg(asSuperAdmin(), resDouble(), ORG_B), ORG_B);
    });

    test('rejects a user with no organization even when ids look absent', () => {
        const res = resDouble();
        const out = requireOwnOrg({ user: { role: 'admin' } }, res, undefined);
        assert.equal(out, null);
        assert.equal(res.statusCode, 403);
    });
});
