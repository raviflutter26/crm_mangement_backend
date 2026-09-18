const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/payrollRunController');

router.get('/', authenticate, authorize('owner', 'admin', 'hr'), ctrl.getPayrollRuns);
router.get('/:id', authenticate, authorize('owner', 'admin', 'hr'), ctrl.getPayrollRunById);
router.post('/initiate', authenticate, authorize('admin', 'hr'), ctrl.initiatePayrollRun);
router.patch('/:id/approve', authenticate, authorize('admin'), ctrl.approvePayrollRun);
router.post('/:id/lock', authenticate, authorize('admin'), ctrl.lockPayrollRun);
router.patch('/:id/pay', authenticate, authorize('admin'), ctrl.markAsPaid);
router.delete('/:id', authenticate, authorize('admin'), ctrl.deletePayrollRun);

module.exports = router;
