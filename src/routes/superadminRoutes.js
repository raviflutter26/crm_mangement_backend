const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { protect, authorize } = require('../middleware/auth');

// All routes restricted to SuperAdmin
router.use(protect);
router.use(authorize('superadmin'));

router.get('/analytics', superadminController.getAnalytics);
router.get('/audit-log', superadminController.getAuditLog);
router.get('/invitations', superadminController.getInvitations);
router.get('/locked-accounts', superadminController.getLockedAccounts);
router.get('/sidebar-counts', superadminController.getSidebarCounts);
router.get('/modules/:slug', superadminController.getModuleData);

module.exports = router;
