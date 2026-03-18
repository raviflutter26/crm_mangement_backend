const express = require('express');
const router = express.Router();
const salaryTemplateController = require('../controllers/salaryTemplateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.route('/')
    .get(salaryTemplateController.getTemplates)
    .post(authorize('Admin', 'HR'), salaryTemplateController.saveTemplate);

router.post('/calculate', salaryTemplateController.calculateBreakdown);

router.delete('/:id', authorize('Admin', 'HR'), salaryTemplateController.deleteTemplate);

module.exports = router;
