const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/complianceController');

router.get('/', authenticate, ctrl.getSettings);
router.put('/', authenticate, authorize('admin', 'hr'), ctrl.updateSettings);
router.get('/pt-slabs', authenticate, ctrl.getPTSlabs);
router.put('/pt-slabs', authenticate, authorize('admin', 'hr'), ctrl.updatePTSlabs);

module.exports = router;
