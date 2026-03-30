import express from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/login', authLimiter, authController.login);
router.post('/setup-password', authController.setupPassword);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

export default router;
