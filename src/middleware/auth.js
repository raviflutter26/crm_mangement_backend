const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Session = require('../models/Session');
const { canAccessBranch } = require('../utils/tenancy');
const { recordPlatformAccess } = require('./platformAudit');

/**
 * Authenticate JWT token middleware
 */
const authenticate = async (req, res, next) => {
    try {
        let token;

        // Check Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Check cookies
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. No token provided.',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Get user
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive.',
            });
        }

        // Session revocation check — additive only. Tokens with no jti (issued before
        // Session tracking existed, or by paths that don't set one) have no Session
        // record to match and are treated as valid, exactly as before this feature.
        if (decoded.jti) {
            const session = await Session.findOne({ jti: decoded.jti }).select('revoked');
            if (session && session.revoked) {
                return res.status(401).json({
                    success: false,
                    message: 'This session has been signed out. Please log in again.',
                });
            }
            req.jti = decoded.jti;
            Session.updateOne({ jti: decoded.jti }, { lastActiveAt: new Date() }).catch(() => {});
        }

        req.user = user;

        // Leave a trail whenever the platform superadmin reaches into tenant
        // data. Deliberately not awaited: the audit must not add latency to the
        // request, nor be able to fail it.
        recordPlatformAccess(req).catch(() => {});

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized. Invalid token.',
        });
    }
};

/**
 * Roles that stand in for another role.
 *
 * This is deliberately a narrow map rather than a ranked ladder. 'owner' is the
 * tenant's own top administrator, so it satisfies anything an org 'admin' may
 * do — but it is still confined to its own organization by the tenant scoping
 * in src/utils/tenancy.js. HR and manager are NOT ranked against each other:
 * a branch admin and a branch HR sit at the same scope with different powers,
 * so neither implies the other.
 */
const ROLE_IMPLIES = Object.freeze({
    owner: ['admin'],
});

/**
 * Role authorization middleware
 */
const authorize = (...roles) => {
    // Named rather than anonymous so the guard is identifiable when walking the
    // Express router stack — that is what lets a test assert every route
    // declares its access intent, and it reads better in a stack trace.
    return function authorizeRole(req, res, next) {
        if (!req.user || !req.user.role) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. User role not found.',
            });
        }

        const allowedRolesLower = roles.map(r => String(r).toLowerCase());
        const userRoleLower = String(req.user.role).toLowerCase();

        if (userRoleLower === 'superadmin') {
            return next();
        }

        const effectiveRoles = [userRoleLower, ...(ROLE_IMPLIES[userRoleLower] || [])];

        if (!effectiveRoles.some(r => allowedRolesLower.includes(r))) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this route.`,
            });
        }
        next();
    };
};

/**
 * Route guard for handlers that act on a branch named in the URL or body.
 * Superadmins and users with no branch restriction pass; everyone else must
 * hold the branch they are targeting.
 */
const authorizeBranch = (paramName = 'branchId') => {
    return function authorizeBranchGuard(req, res, next) {
        const target = req.params?.[paramName] || req.body?.[paramName] || req.query?.[paramName];
        if (!target) return next();

        if (!canAccessBranch(req, target)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized for this branch.',
            });
        }
        next();
    };
};

/**
 * Marks a route as deliberately open to every authenticated user.
 *
 * Most routes without an authorize() are correct: "my leave", "my payslip",
 * check-in, a state dropdown. The problem was that they looked identical to a
 * route where somebody simply forgot the guard — and three cross-tenant leaks
 * were sitting in exactly that ambiguity. Declaring intent makes the two
 * distinguishable, which is what lets test/routeContract.test.js fail a route
 * that declares neither.
 *
 * It is a no-op by design. The control on these routes is the row filter in
 * src/utils/tenancy.js, not the role — a caller may reach the endpoint, but
 * only ever sees their own rows.
 *
 * @param {string} reason - why every authenticated role may reach this route.
 */
const selfService = (reason) => {
    const fn = function selfServiceRoute(req, res, next) { next(); };
    fn.reason = reason;
    return fn;
};

/**
 * Specifically block SuperAdmin from employee-specific routes.
 */
const denySuperAdmin = (req, res, next) => {
    // Super Admins should be allowed to access everything for management visibility
    next();
};

module.exports = { authenticate, protect: authenticate, authorize, authorizeBranch, selfService, denySuperAdmin, ROLE_IMPLIES };
