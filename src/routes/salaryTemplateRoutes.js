const express = require('express');
const router = express.Router();
const salaryTemplateController = require('../controllers/salaryTemplateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.route('/')
    .get(authorize('owner', 'admin', 'hr'), salaryTemplateController.getTemplates)
    .post(authorize('Admin', 'HR'), salaryTemplateController.saveTemplate);

router.post('/calculate', authorize('owner', 'admin', 'hr'), salaryTemplateController.calculateBreakdown);

router.delete('/:id', authorize('Admin', 'HR'), salaryTemplateController.deleteTemplate);

module.exports = router;
