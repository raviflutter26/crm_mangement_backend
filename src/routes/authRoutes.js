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

// User Management (Admin only)
router.get('/users', authenticate, authorize('admin'), authController.getAllUsers);
router.put('/users/:id', authenticate, authorize('admin'), authController.updateUser);

module.exports = router;
