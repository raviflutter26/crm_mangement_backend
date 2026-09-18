const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Project = require('../models/Project');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(Project, 'Project');

router.use(authenticate);
router.get('/', selfService('project list is visible across the tenant'), ctrl.getAll);
router.get('/:id', selfService('project list is visible across the tenant'), ctrl.getById);
router.post('/', authorize('admin', 'manager'), ctrl.create);
router.put('/:id', authorize('admin', 'manager'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
