import express from 'express';
import * as masterController from '../controllers/master.controller';

const router = express.Router();

/**
 * Public routes (or protected if needed, but usually onboarding needs these)
 */
router.get('/industries', masterController.getIndustries);

export default router;
