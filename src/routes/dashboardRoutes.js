const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, selfService } = require('../middleware/auth');

router.get('/', selfService('tenant-scoped dashboard; each role sees its own slice'), authenticate, dashboardController.getDashboard);
router.get('/analytics', selfService('tenant-scoped dashboard; each role sees its own slice'), authenticate, dashboardController.getAnalytics);

module.exports = router;
