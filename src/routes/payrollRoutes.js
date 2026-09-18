const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticate, authorize, selfService, denySuperAdmin, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate, denySuperAdmin);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('payroll'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.get('/summary', authorize('owner', 'admin', 'hr'), payrollController.getPayrollSummary);
router.post('/sync', authorize('admin', 'hr'), payrollController.syncFromZoho);
// Employees reach their own payslip; the handler enforces that and the tenant.
router.get('/payslip/:employeeId/:payRunId', selfService('own payslip; handler checks self and tenant'), payrollController.getPayslip);
// Specific routes must come before the generic '/:id' route below to avoid collision.
router.get('/attendance-summary', authorize('owner', 'admin', 'hr', 'manager'), payrollController.getAttendanceSummary);
router.get('/audit-logs', authorize('owner', 'admin', 'hr'), payrollController.getPayrollAuditLogs);

router.route('/')
    .get(selfService('employees see only their own payroll rows — see getPayroll'), payrollController.getPayroll)
    .post(authorize('admin', 'hr'), payrollController.createPayroll);

router.route('/:id')
    .get(selfService('an employee may fetch only their own record — see getPayrollById'), payrollController.getPayrollById)
    .put(authorize('admin', 'hr'), payrollController.updatePayroll);

module.exports = router;
