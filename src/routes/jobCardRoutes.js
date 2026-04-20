const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const JobCard = require('../models/JobCard');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(JobCard, 'JobCard', 'employee');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.delete);

module.exports = router;
