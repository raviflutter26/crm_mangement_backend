const express = require('express');
const router = express.Router();
const attendanceConfigController = require('../controllers/attendanceConfigController');
const { authenticate, authorize, denySuperAdmin } = require('../middleware/auth');

router.use(authenticate, denySuperAdmin);

router.get('/', attendanceConfigController.getConfig);
router.put('/', authorize('Admin', 'HR'), attendanceConfigController.updateConfig);

module.exports = router;
