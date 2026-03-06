const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/permissionController');

// Employee requests permission
router.post('/request', authenticate, authorize('employee'), ctrl.requestPermission);

// Employee gets their own permissions
router.get('/my-permissions', authenticate, authorize('employee'), ctrl.getMyPermissions);

// Manager gets permissions for their team
router.get('/team-permissions', authenticate, authorize('manager', 'admin', 'hr'), ctrl.getTeamPermissions);

// Manager approves/rejects permission
router.patch('/:id/approve', authenticate, authorize('manager', 'admin', 'hr'), ctrl.handlePermissionStatus);

// Employee cancels their own permission request
router.patch('/:id/cancel', authenticate, authorize('employee'), ctrl.cancelPermission);

module.exports = router;
