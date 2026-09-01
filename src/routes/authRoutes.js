const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/create-password', authController.createPassword);
router.get('/reset-password/:resettoken', authController.verifyResetToken);
router.put('/reset-password/:resettoken', authController.resetPassword);

// MFA
router.post('/mfa/challenge', authController.mfaChallenge); // completes login, uses a preAuthToken instead of a full session
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
