const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize, selfService, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('employees'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.get('/stats', authorize('owner', 'admin', 'hr', 'manager'), employeeController.getStats);
router.post('/sync', authorize('admin', 'hr'), employeeController.syncFromZoho);
// The manager list feeds a reporting-line picker, so every role needs it.
router.get('/managers', selfService('reporting-line picker; names and roles only'), employeeController.getManagers);

router.route('/')
    // The roster is a staff-management view: managers are narrowed to their own
    // department inside the handler. An employee reaches their own record via
    // /api/auth/me, not by listing everyone.
    .get(authorize('owner', 'admin', 'hr', 'manager'), employeeController.getEmployees)
    .post(authorize('admin', 'hr'), employeeController.createEmployee);

router.route('/:id')
    .get(authorize('owner', 'admin', 'hr', 'manager'), employeeController.getEmployee)
    .put(authorize('admin', 'hr'), employeeController.updateEmployee)
    .delete(authorize('admin'), employeeController.deleteEmployee);

router.put('/:id/bank', authorize('admin', 'hr'), employeeController.updateBankDetails);
router.put('/:id/salary-structure', authorize('admin', 'hr'), employeeController.updateSalaryStructure);

module.exports = router;
