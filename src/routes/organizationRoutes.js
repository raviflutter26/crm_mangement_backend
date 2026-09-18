const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate, authorize, selfService, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');
const shiftRoutes = require('./shiftRoutes');
const locationRoutes = require('./locationRoutes');

// Public or Protected depending on requirement, usually Admin only
router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('organization'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

// Sub-resources MUST come before /:id wildcard to prevent Express matching them as IDs
router.get('/designations', selfService('designation list feeds employee forms'), organizationController.getDesignations);
router.post('/designations', authorize('Admin', 'HR'), organizationController.createDesignation);

// Tenant-scoped. /api/branches is the scope-aware endpoint that also confines
// the result to the branches the caller holds; prefer it in new UI.
router.get('/branches', selfService('branch list feeds pickers; tenant-scoped'), organizationController.getBranches);
router.post('/branches', authorize('Admin', 'HR'), organizationController.createBranch);

router.get('/holidays', selfService('holiday calendar is shown to every employee'), organizationController.getHolidays);
router.post('/holidays', authorize('Admin', 'HR'), organizationController.createHoliday);

// Nested routes to support legacy frontend paths
router.use('/shifts', shiftRoutes);
router.use('/locations', locationRoutes);

// Organization Management (/:id wildcard AFTER sub-resources)
router.post('/', authorize('Admin'), organizationController.createOrganization);
router.get('/', selfService('a tenant user receives only their own organization — see getOrganizations'), organizationController.getOrganizations);
router.get('/:id', selfService('requireOwnOrg confines this to the caller\'s organization'), organizationController.getOrganizationById);
router.put('/:id', authorize('Admin', 'HR'), organizationController.updateOrganization);
router.patch('/:id/status', authorize('superadmin'), organizationController.updateOrganizationStatus);
router.delete('/:id', authorize('superadmin'), organizationController.deleteOrganization);
router.post('/:id/impersonate', authorize('superadmin'), organizationController.impersonateOrganization);

module.exports = router;
