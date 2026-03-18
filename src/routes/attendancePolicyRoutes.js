const express = require('express');
const router = express.Router();
const attendancePolicyController = require('../controllers/attendancePolicyController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', attendancePolicyController.getPolicy);
router.put('/', authorize('Admin', 'HR'), attendancePolicyController.updatePolicy);

module.exports = router;
