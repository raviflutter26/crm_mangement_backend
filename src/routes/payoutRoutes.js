const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate, authorize, selfService } = require('../middleware/auth');

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
 * @route GET /api/payouts/run/:runId
 * @desc All payout transactions for a single payroll run
 */
router.get('/run/:runId', authorize('Admin', 'HR'), payoutController.getByRun);

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
// Provider callback from RazorpayX. It sits behind authenticate today, which a
// provider cannot satisfy — signature verification is the right control here.
router.post('/webhook', selfService('payment-provider callback; needs signature verification, not a role'), payoutController.handleWebhook);

module.exports = router;
