const express = require('express');
const router = express.Router();
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = require('../controllers/complianceController');

router.get('/', selfService('statutory reference data'), authenticate, ctrl.getSettings);
router.put('/', authenticate, authorize('admin', 'hr'), ctrl.updateSettings);
router.get('/pt-slabs', selfService('statutory reference data'), authenticate, ctrl.getPTSlabs);
router.put('/pt-slabs', authenticate, authorize('admin', 'hr'), ctrl.updatePTSlabs);

module.exports = router;
