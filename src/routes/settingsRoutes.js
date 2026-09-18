const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize, selfService, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('settings'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

// Global settings restricted to Admin and HR roles
router.get('/attendance', selfService('attendance rules shown in the check-in UI'), settingsController.getAttendanceSettings);
router.post('/attendance', authorize('Admin', 'HR'), settingsController.updateAttendanceSettings);

module.exports = router;
