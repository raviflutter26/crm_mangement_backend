const express = require('express');
const router = express.Router();
const payrollReportController = require('../controllers/payrollReportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.route('/')
    .get(payrollReportController.getReports)
    .post(authorize('admin', 'hr'), payrollReportController.generateReport);

router.get('/export', payrollReportController.exportReport);

router.route('/:id')
    .get(payrollReportController.getReportById);

router.get('/:id/download', payrollReportController.downloadReport);

module.exports = router;
