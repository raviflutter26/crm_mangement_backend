const express = require('express');
const router = express.Router();
const systemHealthController = require('../controllers/systemHealthController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @desc    System Health routes - Restricted to Superadmin
 * @route   GET /api/system/health
 */
router.get('/health', authenticate, authorize('superadmin'), systemHealthController.getSystemHealth);

module.exports = router;
