const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

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
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this route.`,
            });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
