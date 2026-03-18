const express = require('express');
const router = express.Router();
const statutoryController = require('../controllers/statutoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Statutory Dashboard Stats
router.get('/dashboard', authorize('Admin', 'HR'), statutoryController.getStatutoryStats);

// PF Report
router.get('/pf-report', authorize('Admin', 'HR'), statutoryController.getPFReport);

// ESI Report
router.get('/esi-report', authorize('Admin', 'HR'), statutoryController.getESIReport);

// Update Employee Statutory Fields
router.post('/employee-update', authorize('Admin', 'HR'), statutoryController.updateEmployeeStatutory);

module.exports = router;
