const express = require('express');
const router = express.Router();
const payrollReportController = require('../controllers/payrollReportController');
const { authenticate, authorize, authorizeBranch, selfService } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('reports'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.route('/')
    .get(selfService('tenant-scoped report list'), payrollReportController.getReports)
    .post(authorize('admin', 'hr'), payrollReportController.generateReport);

router.get('/export', authorize('owner', 'admin', 'hr'), payrollReportController.exportReport);

router.route('/:id')
    .get(selfService('tenant-scoped report list'), payrollReportController.getReportById);

router.get('/:id/download', authorize('owner', 'admin', 'hr'), payrollReportController.downloadReport);

module.exports = router;
