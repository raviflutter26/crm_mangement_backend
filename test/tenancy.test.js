const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    isSuperAdmin, scopeFilter, orgIdFor, withOrg, requireOrg, requireOwnOrg,
    isOwner, scopeLevelFor, branchIdsFor, branchIdFor, departmentIdFor,
    withScope, requireBranch, canAccessBranch,
} = require('../src/utils/tenancy');

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

// --- role x scope -----------------------------------------------------------

const BRANCH_1 = '660000000000000000000001';
const BRANCH_2 = '660000000000000000000002';
const DEPT_1 = '670000000000000000000001';

const asOwner = (overrides = {}) => ({
    user: { role: 'owner', organizationId: ORG_A, branchIds: [] },
    query: {}, body: {}, ...overrides,
});

const asBranchHr = (branches = [BRANCH_1], overrides = {}) => ({
    user: { role: 'hr', organizationId: ORG_A, branchIds: branches },
    query: {}, body: {}, ...overrides,
});

const asManager = (overrides = {}) => ({
    user: { role: 'manager', organizationId: ORG_A, branchIds: [BRANCH_1], departmentId: DEPT_1 },
    query: {}, body: {}, ...overrides,
});

describe('scopeLevelFor', () => {
    test('maps each role to the widest rows it may reach', () => {
        assert.equal(scopeLevelFor(asSuperAdmin()), 'platform');
        assert.equal(scopeLevelFor(asOwner()), 'organization');
        assert.equal(scopeLevelFor(asAdmin()), 'branch');
        assert.equal(scopeLevelFor(asBranchHr()), 'branch');
        assert.equal(scopeLevelFor(asManager()), 'department');
    });

    test('branch admin and branch HR sit at the same level, neither above the other', () => {
        // This is why role and scope are separate axes: a flat ladder would have
        // to rank HR under admin, which is not what the hierarchy means.
        assert.equal(scopeLevelFor(asAdmin()), scopeLevelFor(asBranchHr()));
    });

    test('an unknown role falls back to the narrowest scope, never the widest', () => {
        assert.equal(scopeLevelFor({ user: { role: 'wharever' } }), 'self');
        assert.equal(scopeLevelFor({ user: {} }), 'self');
        assert.equal(scopeLevelFor({}), 'self');
    });

    test('isOwner is case-insensitive and does not match other roles', () => {
        assert.equal(isOwner({ user: { role: 'OWNER' } }), true);
        assert.equal(isOwner(asAdmin()), false);
        assert.equal(isOwner(asSuperAdmin()), false);
    });
});

describe('branchIdsFor', () => {
    test('an empty list means every branch, not no branch', () => {
        assert.deepEqual(branchIdsFor(asOwner()), []);
    });

    test('coerces ids to strings so ObjectId and string compare equal', () => {
        const req = asBranchHr([{ toString: () => BRANCH_1 }]);
        assert.deepEqual(branchIdsFor(req), [BRANCH_1]);
    });

    test('a missing or non-array value is treated as unrestricted', () => {
        assert.deepEqual(branchIdsFor({ user: {} }), []);
        assert.deepEqual(branchIdsFor({ user: { branchIds: 'nope' } }), []);
    });

    test('drops null entries rather than matching on null', () => {
        assert.deepEqual(branchIdsFor(asBranchHr([BRANCH_1, null])), [BRANCH_1]);
    });
});

describe('scopeFilter with branch narrowing', () => {
    test('is unchanged when branch narrowing is not requested', () => {
        // Every existing call site passes no options and must keep behaving
        // exactly as before, even for a user who now carries branchIds.
        assert.deepEqual(scopeFilter(asBranchHr()), { organizationId: ORG_A });
    });

    test('confines a branch user to their branches when requested', () => {
        assert.deepEqual(scopeFilter(asBranchHr([BRANCH_1]), { branch: true }), {
            organizationId: ORG_A,
            branchId: { $in: [BRANCH_1] },
        });
    });

    test('an admin over several branches sees all of them', () => {
        assert.deepEqual(scopeFilter(asBranchHr([BRANCH_1, BRANCH_2]), { branch: true }), {
            organizationId: ORG_A,
            branchId: { $in: [BRANCH_1, BRANCH_2] },
        });
    });

    test('an owner is not narrowed by branch', () => {
        assert.deepEqual(scopeFilter(asOwner(), { branch: true }), { organizationId: ORG_A });
    });

    test('a superadmin is never narrowed by branch', () => {
        assert.deepEqual(scopeFilter(asSuperAdmin(), { branch: true }), {});
    });

    test('ignores a client-supplied branchId', () => {
        const req = asBranchHr([BRANCH_1], { query: { branchId: BRANCH_2 } });
        assert.deepEqual(scopeFilter(req, { branch: true }), {
            organizationId: ORG_A,
            branchId: { $in: [BRANCH_1] },
        });
    });
});

describe('scopeFilter with department narrowing', () => {
    test('confines a manager to their own department', () => {
        assert.deepEqual(scopeFilter(asManager(), { branch: true, department: true }), {
            organizationId: ORG_A,
            branchId: { $in: [BRANCH_1] },
            departmentId: DEPT_1,
        });
    });

    test('a department-scoped user with no department fails closed', () => {
        // Resolving to the whole branch instead would silently promote a
        // misconfigured manager to branch-wide visibility.
        const req = asManager();
        req.user.departmentId = null;
        assert.deepEqual(scopeFilter(req, { department: true }), { _id: { $in: [] } });
    });

    test('does not narrow roles that are not department-scoped', () => {
        assert.deepEqual(scopeFilter(asBranchHr([BRANCH_1]), { department: true }), {
            organizationId: ORG_A,
        });
    });

    test('departmentIdFor returns null rather than undefined when absent', () => {
        assert.equal(departmentIdFor(asOwner()), null);
        assert.equal(departmentIdFor(asManager()), DEPT_1);
    });
});

describe('branchIdFor', () => {
    test('a user confined to one branch gets it implicitly', () => {
        assert.equal(branchIdFor(asBranchHr([BRANCH_1])), BRANCH_1);
    });

    test('a user over several branches must name one', () => {
        assert.equal(branchIdFor(asBranchHr([BRANCH_1, BRANCH_2])), null);
        assert.equal(branchIdFor(asBranchHr([BRANCH_1, BRANCH_2]), BRANCH_2), BRANCH_2);
    });

    test('rejects a branch the user does not hold instead of substituting one', () => {
        // Silently rewriting it to their own branch would make a forged write
        // look like it succeeded against the branch the client asked for.
        assert.equal(branchIdFor(asBranchHr([BRANCH_1]), BRANCH_2), null);
    });

    test('an unrestricted user may name any branch', () => {
        assert.equal(branchIdFor(asOwner(), BRANCH_2), BRANCH_2);
    });

    test('an unrestricted user naming nothing is ambiguous, not a silent default', () => {
        assert.equal(branchIdFor(asOwner()), null);
    });
});

describe('withScope', () => {
    test('strips branchId and departmentId unless they are asked for', () => {
        const out = withScope(asOwner(), { name: 'x', branchId: BRANCH_2, departmentId: DEPT_1 });
        assert.equal(out.branchId, undefined);
        assert.equal(out.departmentId, undefined);
        assert.equal(out.organizationId, ORG_A);
    });

    test('stamps the caller\'s only branch', () => {
        const out = withScope(asBranchHr([BRANCH_1]), { name: 'x' }, { branch: true });
        assert.equal(out.branchId, BRANCH_1);
    });

    test('overwrites a forged branchId with nothing rather than trusting it', () => {
        const out = withScope(asBranchHr([BRANCH_1]), { branchId: BRANCH_2 }, { branch: true });
        assert.equal(out.branchId, undefined, 'a branch the caller does not hold must not be stamped');
    });

    test('a manager writes into their own department, not the one they sent', () => {
        const out = withScope(asManager(), { departmentId: '670000000000000000000099' }, { department: true });
        assert.equal(out.departmentId, DEPT_1);
    });

    test('an org-scoped caller may place a document in any department', () => {
        const out = withScope(asOwner(), { departmentId: DEPT_1 }, { department: true });
        assert.equal(out.departmentId, DEPT_1);
    });

    test('does not mutate the caller\'s payload', () => {
        const payload = { branchId: BRANCH_2, organizationId: ORG_B };
        withScope(asBranchHr([BRANCH_1]), payload, { branch: true });
        assert.equal(payload.branchId, BRANCH_2);
        assert.equal(payload.organizationId, ORG_B);
    });
});

describe('requireBranch', () => {
    test('returns the caller\'s only branch', () => {
        assert.equal(requireBranch(asBranchHr([BRANCH_1]), resDouble()), BRANCH_1);
    });

    test('400s when the caller spans branches and named none', () => {
        const res = resDouble();
        assert.equal(requireBranch(asBranchHr([BRANCH_1, BRANCH_2]), res), null);
        assert.equal(res.statusCode, 400);
    });

    test('403s when the caller named a branch they do not hold', () => {
        const res = resDouble();
        assert.equal(requireBranch(asBranchHr([BRANCH_1]), res, BRANCH_2), null);
        assert.equal(res.statusCode, 403);
    });

    test('a superadmin must still name a branch explicitly', () => {
        const res = resDouble();
        assert.equal(requireBranch(asSuperAdmin(), res), null);
        assert.equal(res.statusCode, 400);
        assert.equal(requireBranch(asSuperAdmin({ body: { branchId: BRANCH_2 } }), resDouble()), BRANCH_2);
    });
});

describe('canAccessBranch', () => {
    test('an unrestricted user reaches every branch', () => {
        assert.equal(canAccessBranch(asOwner(), BRANCH_2), true);
    });

    test('a branch user reaches only their own', () => {
        assert.equal(canAccessBranch(asBranchHr([BRANCH_1]), BRANCH_1), true);
        assert.equal(canAccessBranch(asBranchHr([BRANCH_1]), BRANCH_2), false);
    });

    test('a superadmin reaches any branch', () => {
        assert.equal(canAccessBranch(asSuperAdmin(), BRANCH_2), true);
    });
});

/**
 * "Empty means every branch" is right for an owner and dangerous for the two
 * roles that exist to be confined. These pin the rule that closed it.
 */
describe('scopeFilter: unassigned branch roles', () => {
    const ORG = 'org-a';
    const at = (user) => scopeFilter({ user, query: {} }, { branch: true });

    test('an admin holding no branches resolves to no rows', () => {
        assert.deepEqual(at({ role: 'admin', organizationId: ORG }), { _id: { $in: [] } });
    });

    test('an hr holding no branches resolves to no rows', () => {
        assert.deepEqual(at({ role: 'hr', organizationId: ORG }), { _id: { $in: [] } });
    });

    test('isGroupWide is what grants organization-wide visibility', () => {
        assert.deepEqual(at({ role: 'hr', organizationId: ORG, isGroupWide: true }), { organizationId: ORG });
    });

    test('holding a branch is unaffected by the flag', () => {
        assert.deepEqual(
            at({ role: 'admin', organizationId: ORG, branchIds: ['b1'] }),
            { organizationId: ORG, branchId: { $in: ['b1'] } }
        );
    });

    test('an owner is organization-scoped, so the rule never applies', () => {
        assert.deepEqual(at({ role: 'owner', organizationId: ORG }), { organizationId: ORG });
    });

    test('an employee is not a branch role, so the rule never applies', () => {
        assert.deepEqual(at({ role: 'employee', organizationId: ORG }), { organizationId: ORG });
    });

    test('the rule only applies when branch narrowing was requested', () => {
        assert.deepEqual(
            scopeFilter({ user: { role: 'hr', organizationId: ORG }, query: {} }),
            { organizationId: ORG }
        );
    });

    test('a superadmin is never narrowed', () => {
        assert.deepEqual(at({ role: 'superadmin' }), {});
    });
});
