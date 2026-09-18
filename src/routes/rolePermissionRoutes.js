const express = require('express');
const router = express.Router();
const { getModulePermissions, updateAllPermissions } = require('../controllers/rolePermissionController');
const { authenticate, authorize, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

// Admin and HR should manage permissions
router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('roles'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());
router.use(authorize('Admin', 'HR'));

router.get('/', getModulePermissions);
router.put('/', updateAllPermissions);

module.exports = router;
