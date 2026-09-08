const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Reporting
router.get('/summary', authorize('admin', 'manager'), revenueController.getSummary);
router.get('/by-project', authorize('admin', 'manager'), revenueController.getByProject);

// Invoices — listed before '/invoices/:id' so 'summary'-style literals can't be
// swallowed by the id parameter.
router.get('/invoices', authorize('admin', 'manager'), revenueController.getInvoices);
router.post('/invoices', authorize('admin'), revenueController.createInvoice);
router.get('/invoices/:id', authorize('admin', 'manager'), revenueController.getInvoiceById);
router.put('/invoices/:id', authorize('admin'), revenueController.updateInvoice);
router.delete('/invoices/:id', authorize('admin'), revenueController.deleteInvoice);
router.post('/invoices/:id/payments', authorize('admin'), revenueController.recordPayment);

module.exports = router;
