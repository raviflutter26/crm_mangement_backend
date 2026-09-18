const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const JobCard = require('../models/JobCard');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(JobCard, 'JobCard', 'employee');

router.use(authenticate);
router.get('/', selfService('employee-owned rows, tenant-scoped'), ctrl.getAll);
router.get('/my', selfService('employee-owned rows, tenant-scoped'), ctrl.getMyRecords);
router.get('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.getById);
router.post('/', selfService('employee-owned rows, tenant-scoped'), ctrl.create);
router.put('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.delete);

module.exports = router;
