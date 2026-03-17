const express = require('express');
const router = express.Router();
const { getModulePermissions, updateAllPermissions } = require('../controllers/rolePermissionController');
const { authenticate, authorize } = require('../middleware/auth');

// Only Admins should manage permissions
router.use(authenticate);
router.use(authorize('Admin'));

router.get('/', getModulePermissions);
router.put('/', updateAllPermissions);

module.exports = router;
