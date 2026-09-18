const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticate, authorize, denySuperAdmin, authorizeBranch, selfService } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate, denySuperAdmin);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('leaves'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.get('/balance/:employeeId', selfService('own leave; reads are scoped by branch and department'), leaveController.getLeaveBalance);
router.put('/:id/status', authorize('admin', 'hr', 'manager'), leaveController.updateLeaveStatus);

router.route('/')
    .get(selfService('own leave; reads are scoped by branch and department'), leaveController.getLeaves)
    .post(selfService('own leave; reads are scoped by branch and department'), leaveController.applyLeave);

module.exports = router;
