const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');
const { authenticate, authorize } = require('../middleware/auth');

// Protected Routes (Admin/HR only)
router.use(authenticate);

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
