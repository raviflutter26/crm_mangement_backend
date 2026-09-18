const ModulePermission = require('../models/ModulePermission');
const { isSuperAdmin, roleOf, ROLES } = require('../utils/tenancy');

/**
 * Enforces the per-tenant module grants that ModulePermission has always
 * stored but nothing ever read.
 *
 * Until now access was decided entirely by the hard-coded role lists in the
 * route files, so the "Roles & Permissions" screen was configuration that
 * changed nothing — a tenant could revoke a module and watch it stay
 * reachable. This closes that gap.
 *
 * ADDITIVE BY DESIGN. It narrows, never widens:
 *
 *   no row for this module  -> allow, and let authorize() decide as before
 *   row exists              -> the caller's role must appear in it
 *
 * That fallback matters because most tenants have no rows at all, and a
 * tenant that has never opened the permissions screen must keep working
 * exactly as it did. A module grant can therefore take access away from a role
 * the route would have allowed, but can never hand access to a role the route
 * denies — authorize() still runs, and both must pass.
 *
 * superadmin and owner always pass: superadmin bypasses every check in the
 * system, and owner is the tenant's own top administrator, who must not be
 * able to lock themselves out of the screen that edits these very grants.
 */
const requireModule = (moduleName) => {
    return async function requireModuleGuard(req, res, next) {
        try {
            if (isSuperAdmin(req)) return next();

            const role = roleOf(req);
            if (role === ROLES.OWNER) return next();

            const orgId = req.user?.organizationId;
            if (!orgId) return next(); // nothing to look up; authorize() still applies

            const grant = await ModulePermission
                .findOne({ organizationId: orgId, module: moduleName })
                .select('roles')
                .lean();

            // No configuration for this module: unchanged behaviour.
            if (!grant || !Array.isArray(grant.roles) || grant.roles.length === 0) return next();

            // .lean() skips the post('init') normalizer, so compare defensively —
            // rows seeded before the setter existed still carry 'Admin'/'HR'.
            const allowed = grant.roles.map(r => String(r).toLowerCase());
            if (!allowed.includes(role)) {
                return res.status(403).json({
                    success: false,
                    message: `The '${moduleName}' module is not enabled for the '${role}' role in this organization.`,
                });
            }

            return next();
        } catch (err) {
            // A lookup failure must not hand out access it cannot verify, but it
            // also must not take down every route: fall through to authorize(),
            // which is the behaviour that applied before this middleware existed.
            return next();
        }
    };
};

module.exports = { requireModule };
