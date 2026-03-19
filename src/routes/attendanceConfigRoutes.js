const express = require('express');
const router = express.Router();
const attendanceConfigController = require('../controllers/attendanceConfigController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', attendanceConfigController.getConfig);
router.put('/', authorize('Admin', 'HR'), attendanceConfigController.updateConfig);

module.exports = router;
