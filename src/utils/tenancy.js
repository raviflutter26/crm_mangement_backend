/**
 * Tenant scoping helpers.
 *
 * The organization a request is allowed to touch is always derived from the
 * authenticated user (req.user), never from the request payload. The browser
 * can edit anything it sends, so a client-supplied organizationId is untrusted
 * input — see the interceptor in the website's lib/axios.ts, which attaches one
 * for convenience only.
 *
 * Superadmins are the single exception: they operate across tenants and may
 * target one explicitly via ?organizationId.
 *
 * SCOPE vs ROLE
 * -------------
 * A user's role says what they may do; their scope says which rows they may see.
 * The two are independent axes, so they are stored independently:
 *
 *   platform     superadmin              no organizationId
 *   organization owner                   organizationId, branchIds: []
 *   branch       admin, hr               organizationId, branchIds: [a, b]
 *   department   manager                 organizationId, branchIds: [a], departmentId
 *   self         employee                narrowed by each controller
 *
 * branchIds is empty for anyone who may see every branch in their organization.
 * That is what lets an owner and a group-wide HR share one code path, and it is
 * why users created before branches existed keep working unchanged.
 *
 * With one exception, added because "empty means everything" is a dangerous
 * default for the two roles that exist to be confined: a branch-scoped role
 * (admin, hr) holding no branches now resolves to NO rows unless it is also
 * marked User.isGroupWide. Seeing every branch has to be granted, not reached
 * by leaving a field blank. Owners are unaffected — they are organization-
 * scoped, so branch narrowing never applies to them.
 */

/** Canonical role names. Stored lowercase; see the setter on User.role. */
const ROLES = Object.freeze({
    SUPERADMIN: 'superadmin',
    OWNER: 'owner',
    ADMIN: 'admin',
    HR: 'hr',
    MANAGER: 'manager',
    EMPLOYEE: 'employee',
});

/** Widest set of rows each role may ever reach, before branch/department narrowing. */
const SCOPE_BY_ROLE = Object.freeze({
    [ROLES.SUPERADMIN]: 'platform',
    [ROLES.OWNER]: 'organization',
    [ROLES.ADMIN]: 'branch',
    [ROLES.HR]: 'branch',
    [ROLES.MANAGER]: 'department',
    [ROLES.EMPLOYEE]: 'self',
});

const roleOf = (req) => String(req.user?.role || '').toLowerCase();

const isSuperAdmin = (req) => roleOf(req) === ROLES.SUPERADMIN;

const isOwner = (req) => roleOf(req) === ROLES.OWNER;

/**
 * The scope level a request operates at. Unknown roles fall back to 'self',
 * the narrowest level, so a typo in the role column can never widen access.
 */
const scopeLevelFor = (req) => SCOPE_BY_ROLE[roleOf(req)] || 'self';

/**
 * A filter that provably matches no document, used to fail closed.
 *
 * Returning { organizationId: undefined } instead would be unsafe: an undefined
 * value is dropped or coerced to null depending on driver settings, so the
 * filter could widen to every tenant's rows. $in: [] can never match.
 */
const MATCH_NOTHING = Object.freeze({ _id: { $in: [] } });

/**
 * Branches this user is confined to, as strings. An empty array means "every
 * branch in the organization" — it is not a denial. Callers must treat empty
 * as unrestricted, which is what keeps owners and pre-branch users working.
 */
const branchIdsFor = (req) => {
    const ids = req.user?.branchIds;
    if (!Array.isArray(ids)) return [];
    return ids.filter(Boolean).map(String);
};

/** The department a request is confined to, or null when it spans departments. */
const departmentIdFor = (req) => {
    const id = req.user?.departmentId;
    return id ? String(id) : null;
};

/**
 * Filter to merge into every read. Returns {} for a superadmin with no target
 * org, which intentionally reads across all tenants. For a tenant user with no
 * organization (User.organizationId defaults to null) it fails closed rather
 * than widening to a match-all filter.
 *
 * Branch and department narrowing are opt-in per call site:
 *
 *   scopeFilter(req)                                  organization only
 *   scopeFilter(req, { branch: true })                + branchId
 *   scopeFilter(req, { branch: true, department: true })
 *
 * They are opt-in because a collection can only be filtered by branchId once
 * its documents actually carry one. Passing { branch: true } against a
 * collection that has not been backfilled would match nothing at all. Turn each
 * flag on for a collection only after its rows are stamped — see
 * src/scripts/migrateToBranchScope.js.
 */
const scopeFilter = (req, opts = {}) => {
    if (isSuperAdmin(req)) {
        return req.query?.organizationId ? { organizationId: req.query.organizationId } : {};
    }

    const orgId = req.user?.organizationId;
    if (!orgId) return { ...MATCH_NOTHING };

    const filter = { organizationId: orgId };

    if (opts.branch) {
        const branches = branchIdsFor(req);
        if (branches.length) {
            filter.branchId = { $in: branches };
        } else if (scopeLevelFor(req) === 'branch' && !req.user?.isGroupWide) {
            // A branch-scoped role holding no branches used to fall through to
            // "every branch in the organization" — the exact opposite of what a
            // branch admin or branch HR is for, reached by leaving a field
            // blank. Seeing everything must be an explicit grant, so it now
            // requires isGroupWide; without it this resolves to no rows.
            return { ...MATCH_NOTHING };
        }
    }

    if (opts.department && scopeLevelFor(req) === 'department') {
        const deptId = departmentIdFor(req);
        // A department-scoped user with no department resolves to no rows rather
        // than to their whole branch, for the same fail-closed reason as above.
        if (!deptId) return { ...MATCH_NOTHING };
        filter.departmentId = deptId;
    }

    return filter;
};

/** The organization new documents belong to, or null if it can't be determined. */
const orgIdFor = (req) => {
    if (isSuperAdmin(req)) {
        return req.body?.organizationId || req.query?.organizationId || null;
    }
    return req.user?.organizationId || null;
};

/**
 * The branch a new document belongs to, or null when it cannot be resolved.
 *
 * A caller confined to exactly one branch gets it implicitly. A caller who may
 * write to several (or to all) must name one, and a named branch outside their
 * allowed set is rejected rather than silently replaced.
 */
const branchIdFor = (req, requested) => {
    const allowed = branchIdsFor(req);

    if (requested) {
        const target = String(requested);
        if (allowed.length && !allowed.includes(target)) return null;
        return target;
    }

    if (allowed.length === 1) return allowed[0];
    return null;
};

/**
 * The branch an employee-owned document belongs to.
 *
 * Attendance, leave and payroll rows belong to the branch the EMPLOYEE is
 * posted to, not the branch of whoever wrote the row: when a group HR enters
 * leave for a Bangalore employee, the leave is Bangalore's. That is why these
 * collections cannot use branchIdFor, which resolves the caller's branch.
 *
 * Falls back to a single access branch while User.branchId is still being
 * backfilled, since one access branch is unambiguously also the posting branch.
 */
const branchIdOfEmployee = (employee) => {
    if (!employee) return null;
    if (employee.branchId) return String(employee.branchId);

    const ids = Array.isArray(employee.branchIds) ? employee.branchIds.filter(Boolean) : [];
    return ids.length === 1 ? String(ids[0]) : null;
};

/**
 * Strip any client-supplied tenant key from a write payload, then stamp the
 * trusted one. Use this for every create/update body.
 */
const withOrg = (req, payload = {}) => {
    const clean = { ...payload };
    delete clean.organizationId;
    delete clean.companyId; // legacy tenant key on StatutoryConfig
    const orgId = orgIdFor(req);
    if (orgId) clean.organizationId = orgId;
    return clean;
};

/**
 * withOrg, plus the branch and department a document belongs to.
 *
 * branchId is as untrusted as organizationId: it is read off the payload only
 * to choose among the branches the caller already holds, then re-stamped from
 * the validated value. Returns the payload unstamped when the branch cannot be
 * resolved; pair it with requireBranch when the write cannot proceed without one.
 */
const withScope = (req, payload = {}, opts = {}) => {
    const clean = withOrg(req, payload);
    const requestedBranch = payload.branchId;
    const requestedDept = payload.departmentId;

    delete clean.branchId;
    delete clean.departmentId;

    if (opts.branch) {
        const branchId = branchIdFor(req, requestedBranch);
        if (branchId) clean.branchId = branchId;
    }

    if (opts.department) {
        // A department-scoped caller may only write into their own department.
        // A wider caller may name any department; that it belongs to their own
        // organization is not checked here, because these helpers are
        // deliberately synchronous and database-free. The document's
        // organizationId is still stamped from req.user, so a cross-tenant
        // departmentId yields a dangling reference, not a readable row — but
        // handlers that care should validate the department themselves.
        const own = departmentIdFor(req);
        const deptId = scopeLevelFor(req) === 'department' ? own : requestedDept;
        if (deptId) clean.departmentId = String(deptId);
    }

    return clean;
};

/**
 * Guard for handlers that cannot do anything sensible without a tenant.
 * Sends a 400 and returns null when the context is missing, so callers can
 * `const orgId = requireOrg(req, res); if (!orgId) return;`
 */
const requireOrg = (req, res) => {
    const orgId = orgIdFor(req);
    if (!orgId) {
        res.status(400).json({ success: false, message: 'Organization context is missing.' });
        return null;
    }
    return orgId;
};

/**
 * Guard for handlers that act on an organization named in the URL.
 * Superadmins may target any organization; everyone else is confined to their own.
 * Returns the id to act on, or null after sending a 403.
 */
const requireOwnOrg = (req, res, targetOrgId) => {
    if (isSuperAdmin(req)) return String(targetOrgId);

    const own = String(req.user?.organizationId || '');
    if (!own || String(targetOrgId) !== own) {
        res.status(403).json({ success: false, message: 'Not authorized for this organization.' });
        return null;
    }
    return own;
};

/**
 * Guard for writes that must land in a specific branch. Returns the branch id
 * to stamp, or null after sending a response — 400 when the caller spans
 * several branches and named none, 403 when they named one they do not hold.
 */
const requireBranch = (req, res, requested) => {
    if (isSuperAdmin(req)) {
        const target = requested || req.body?.branchId || req.query?.branchId;
        if (!target) {
            res.status(400).json({ success: false, message: 'Branch context is missing.' });
            return null;
        }
        return String(target);
    }

    const target = requested !== undefined ? requested : req.body?.branchId;
    const branchId = branchIdFor(req, target);

    if (branchId) return branchId;

    // Naming a branch you do not hold is a refusal (403); naming none while you
    // hold several is an incomplete request (400).
    if (target) {
        res.status(403).json({ success: false, message: 'Not authorized for this branch.' });
    } else {
        res.status(400).json({ success: false, message: 'Branch context is missing.' });
    }
    return null;
};

/**
 * True when the caller may reach the given branch. An unrestricted caller
 * (branchIds empty) may reach every branch in their own organization.
 */
const canAccessBranch = (req, targetBranchId) => {
    if (isSuperAdmin(req)) return true;
    const allowed = branchIdsFor(req);
    if (!allowed.length) return true;
    return allowed.includes(String(targetBranchId));
};

module.exports = {
    ROLES,
    SCOPE_BY_ROLE,
    roleOf,
    isSuperAdmin,
    isOwner,
    scopeLevelFor,
    scopeFilter,
    orgIdFor,
    branchIdsFor,
    branchIdFor,
    branchIdOfEmployee,
    departmentIdFor,
    withOrg,
    withScope,
    requireOrg,
    requireOwnOrg,
    requireBranch,
    canAccessBranch,
    MATCH_NOTHING,
};
