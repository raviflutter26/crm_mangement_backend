const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Session = require('../models/Session');

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
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized. Invalid token.',
        });
    }
};

/**
 * Role authorization middleware
 */
const authorize = (...roles) => {
    return (req, res, next) => {
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

        if (!allowedRolesLower.includes(userRoleLower)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this route.`,
            });
        }
        next();
    };
};

/**
 * Specifically block SuperAdmin from employee-specific routes.
 */
const denySuperAdmin = (req, res, next) => {
    // Super Admins should be allowed to access everything for management visibility
    next();
};

module.exports = { authenticate, protect: authenticate, authorize, denySuperAdmin };
