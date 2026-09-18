const express = require('express');
const router = express.Router();
const attendanceConfigController = require('../controllers/attendanceConfigController');
const { authenticate, authorize, selfService, denySuperAdmin } = require('../middleware/auth');

router.use(authenticate, denySuperAdmin);

// Working hours and grace periods are read by every employee's own clock-in UI.
router.get('/', selfService('shift and grace-period settings shown in the check-in UI'), attendanceConfigController.getConfig);
router.put('/', authorize('Admin', 'HR'), attendanceConfigController.updateConfig);

module.exports = router;
