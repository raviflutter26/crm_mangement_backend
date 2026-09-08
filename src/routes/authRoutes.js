const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Credential endpoints need a far tighter budget than the global /api limiter
 * (1000 requests / 15 min), which allows roughly a thousand password guesses
 * per window. Counted per IP + submitted email so one attacker cannot lock out
 * every user from a shared NAT, and successful requests are not counted.
 */
const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
    message: {
        success: false,
        message: 'Too many attempts. Please wait 15 minutes and try again.',
    },
});

/** Password-reset and invite mail is expensive to send and easy to abuse. */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again later.',
    },
});

router.post('/register', credentialLimiter, authController.register);
router.post('/login', credentialLimiter, authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, credentialLimiter, authController.changePassword);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/create-password', credentialLimiter, authController.createPassword);
router.get('/reset-password/:resettoken', authController.verifyResetToken);
router.put('/reset-password/:resettoken', credentialLimiter, authController.resetPassword);

// MFA
// MFA codes are 6 digits — without a limit they are brute-forceable in minutes.
router.post('/mfa/challenge', credentialLimiter, authController.mfaChallenge); // completes login, uses a preAuthToken instead of a full session
router.post('/mfa/setup', authenticate, authController.mfaSetup);
router.post('/mfa/verify', authenticate, authController.mfaVerify);
router.post('/mfa/disable', authenticate, authController.mfaDisable);

// Sessions
router.get('/sessions', authenticate, authController.getSessions);
router.delete('/sessions/:id', authenticate, authController.revokeSession);
router.post('/sessions/revoke-all', authenticate, authController.revokeAllSessions);

// SSO configuration (admin only — settings management, no live provider connection)
router.get('/sso-config', authenticate, authorize('admin'), authController.getSsoConfig);
router.put('/sso-config', authenticate, authorize('admin'), authController.updateSsoConfig);

// User Management (Admin only)
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.put('/users/:id', authenticate, authorize('admin'), authController.updateUser);

module.exports = router;
