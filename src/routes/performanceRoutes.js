const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/performanceController');

// Goals
router.get('/goals', auth, ctrl.getGoals);
router.post('/goals', auth, ctrl.createGoal);
router.put('/goals/:id', auth, ctrl.updateGoal);
router.delete('/goals/:id', auth, ctrl.deleteGoal);

// Appraisals
router.get('/appraisals', auth, ctrl.getAppraisals);
router.post('/appraisals', auth, ctrl.createAppraisal);
router.put('/appraisals/:id', auth, ctrl.updateAppraisal);
router.delete('/appraisals/:id', auth, ctrl.deleteAppraisal);

module.exports = router;
