const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate, authorize } = require('../middleware/auth');
const shiftRoutes = require('./shiftRoutes');
const locationRoutes = require('./locationRoutes');

// Public or Protected depending on requirement, usually Admin only
router.use(authenticate);

// Sub-resources MUST come before /:id wildcard to prevent Express matching them as IDs
router.get('/designations', organizationController.getDesignations);
router.post('/designations', authorize('Admin', 'HR'), organizationController.createDesignation);

router.get('/branches', organizationController.getBranches);
router.post('/branches', authorize('Admin', 'HR'), organizationController.createBranch);

router.get('/holidays', organizationController.getHolidays);
router.post('/holidays', authorize('Admin', 'HR'), organizationController.createHoliday);

// Nested routes to support legacy frontend paths
router.use('/shifts', shiftRoutes);
router.use('/locations', locationRoutes);

// Organization Management (/:id wildcard AFTER sub-resources)
router.post('/', authorize('Admin'), organizationController.createOrganization);
router.get('/', organizationController.getOrganizations);
router.get('/:id', organizationController.getOrganizationById);
router.put('/:id', authorize('Admin', 'HR'), organizationController.updateOrganization);
router.patch('/:id/status', authorize('Admin', 'HR'), organizationController.updateOrganizationStatus);
router.delete('/:id', authorize('Admin'), organizationController.deleteOrganization);
router.post('/:id/impersonate', authorize('Admin'), organizationController.impersonateOrganization);

module.exports = router;
