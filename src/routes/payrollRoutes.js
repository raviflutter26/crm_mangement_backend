const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', payrollController.getPayrollSummary);
router.post('/sync', authorize('admin', 'hr'), payrollController.syncFromZoho);
router.get('/payslip/:employeeId/:payRunId', payrollController.getPayslip);

router.route('/')
    .get(payrollController.getPayroll)
    .post(authorize('admin', 'hr'), payrollController.createPayroll);

router.route('/:id')
    .get(payrollController.getPayrollById)
    .put(authorize('admin', 'hr'), payrollController.updatePayroll);

module.exports = router;
