const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate, authorize } = require('../middleware/auth');
const shiftRoutes = require('./shiftRoutes');
const locationRoutes = require('./locationRoutes');

// Public or Protected depending on requirement, usually Admin only
router.use(authenticate);

// Organization Management
router.post('/', authorize('Admin'), organizationController.createOrganization);
router.get('/', organizationController.getOrganizations);
router.put('/:id', authorize('Admin'), organizationController.updateOrganization);

// Sub-resources (Designations, Branches, Holidays)
router.get('/designations', organizationController.getDesignations);
router.post('/designations', authorize('Admin'), organizationController.createDesignation);

router.get('/branches', organizationController.getBranches);
router.post('/branches', authorize('Admin'), organizationController.createBranch);

router.get('/holidays', organizationController.getHolidays);
router.post('/holidays', authorize('Admin'), organizationController.createHoliday);

// Nested routes to support legacy frontend paths
router.use('/shifts', shiftRoutes);
router.use('/locations', locationRoutes);

module.exports = router;
