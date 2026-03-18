const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Global settings restricted to Admin and HR roles
router.get('/attendance', settingsController.getAttendanceSettings);
router.post('/attendance', authorize('Admin', 'HR'), settingsController.updateAttendanceSettings);

module.exports = router;
