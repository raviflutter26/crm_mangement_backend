const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/permissionController');

// Employee requests permission
router.post('/request', authenticate, authorize('Employee'), ctrl.requestPermission);

// Employee gets their own permissions
router.get('/my-permissions', authenticate, authorize('Employee'), ctrl.getMyPermissions);

// Manager gets permissions for their team
router.get('/team-permissions', authenticate, authorize('Manager', 'Admin', 'HR'), ctrl.getTeamPermissions);

// Manager approves/rejects permission
router.patch('/:id/approve', authenticate, authorize('Manager', 'Admin', 'HR'), ctrl.handlePermissionStatus);

// Employee cancels their own permission request
router.patch('/:id/cancel', authenticate, authorize('Employee'), ctrl.cancelPermission);

module.exports = router;
