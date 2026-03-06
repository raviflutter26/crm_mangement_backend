const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

// Records
router.get('/', authenticate, ctrl.getAttendance);
router.get('/today-summary', authenticate, ctrl.getTodaySummary);
router.get('/monthly-report', authenticate, ctrl.getMonthlyReport);

// Check in/out (biometric/GPS enabled)
router.post('/check-in', authenticate, ctrl.checkIn);
router.post('/check-out', authenticate, ctrl.checkOut);

// Regularization
router.post('/regularize', authenticate, ctrl.requestRegularization);
router.patch('/:id/regularize', authenticate, authorize('admin', 'hr', 'manager'), ctrl.handleRegularization);

// Zoho sync
router.post('/sync', authenticate, authorize('admin', 'hr'), ctrl.syncFromZoho);

module.exports = router;
