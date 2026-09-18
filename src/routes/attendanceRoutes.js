const express = require('express');
const router = express.Router();
const { authenticate, authorize, denySuperAdmin, authorizeBranch, selfService } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');
const ctrl = require('../controllers/attendanceController');

router.use(authenticate, denySuperAdmin);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('attendance'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

// Records
router.get('/', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.getAttendance);
router.get('/today-summary', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.getTodaySummary);
router.get('/monthly-report', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.getMonthlyReport);

// Check in/out (biometric/GPS enabled)
router.post('/check-in', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.checkIn);
router.post('/check-out', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.checkOut);

// Regularization
router.post('/regularize', selfService('own attendance; reads are scoped by branch and department'), authenticate, ctrl.requestRegularization);
router.patch('/:id/regularize', authenticate, authorize('admin', 'hr', 'manager'), ctrl.handleRegularization);

// Zoho sync
router.post('/sync', authenticate, authorize('admin', 'hr'), ctrl.syncFromZoho);

module.exports = router;
