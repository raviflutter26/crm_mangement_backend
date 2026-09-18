const express = require('express');
const {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/departmentController');
const { authenticate, authorize, authorizeBranch, selfService } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('departments'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.route('/')
    // Every role needs the department list: pickers, profile forms, filters.
    // The result is confined to the caller's branches by scopeFilter.
    .get(selfService('department list feeds pickers; branch-scoped'), getDepartments)
    .post(authorize('admin', 'hr'), createDepartment);

router.route('/:id')
    .put(authorize('admin', 'hr'), updateDepartment)
    .delete(authorize('admin'), deleteDepartment);

module.exports = router;
