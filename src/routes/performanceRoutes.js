const express = require('express');
const router = express.Router();
const { authenticate: auth, authorize, selfService } = require('../middleware/auth');
const ctrl = require('../controllers/performanceController');

// Goals
router.get('/goals', auth, selfService('an employee tracks their own goals'), ctrl.getGoals);
router.post('/goals', auth, selfService('an employee sets their own goals'), ctrl.createGoal);
router.put('/goals/:id', auth, selfService('an employee updates their own goal progress'), ctrl.updateGoal);
router.delete('/goals/:id', auth, authorize('owner', 'admin', 'hr', 'manager'), ctrl.deleteGoal);

// Appraisals
router.get('/appraisals', auth, selfService('an employee reads their own appraisal'), ctrl.getAppraisals);
// An appraisal is written about someone, not by them.
router.post('/appraisals', auth, authorize('owner', 'admin', 'hr', 'manager'), ctrl.createAppraisal);
router.put('/appraisals/:id', auth, authorize('owner', 'admin', 'hr', 'manager'), ctrl.updateAppraisal);
router.delete('/appraisals/:id', auth, authorize('owner', 'admin', 'hr'), ctrl.deleteAppraisal);

module.exports = router;
