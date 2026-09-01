const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate, authorize } = require('../middleware/auth');

// Protected Routes (Admin/HR only)
router.use(authenticate);

/**
 * @route GET /api/payouts/status
 * @desc Summary counts of payout transactions for the org
 */
router.get('/status', authorize('Admin', 'HR'), payoutController.getStatus);

/**
 * @route GET /api/payouts/history
 * @desc Full payout transaction history for the org
 */
router.get('/history', authorize('Admin', 'HR'), payoutController.getHistory);

/**
 * @route POST /api/payouts/:id/retry
 * @desc Re-attempt a failed payout transaction
 */
router.post('/:id/retry', authorize('Admin', 'HR'), payoutController.retryPayout);

/**
 * @route POST /api/payouts/initiate
 * @desc Trigger bulk salary payout for a payroll run
 */
router.post('/initiate', authorize('Admin', 'HR'), payoutController.initiatePayout);

/**
 * @route POST /api/payouts/prepare/:employeeId
 * @desc Setup Razorpay contact/fund account for an employee
 */
router.post('/prepare/:employeeId', authorize('Admin', 'HR'), payoutController.prepareEmployee);

// Webhook Route (Unprotected, but should have signature verification in controller)
router.post('/webhook', payoutController.handleWebhook);

module.exports = router;
