const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const PPERecord = require('../models/PPERecord');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(PPERecord, 'PPERecord', 'employee');

router.use(authenticate);
router.get('/', selfService('employee-owned rows, tenant-scoped'), ctrl.getAll);
router.get('/my', selfService('employee-owned rows, tenant-scoped'), ctrl.getMyRecords);
router.get('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.getById);
router.post('/', authorize('admin', 'hr', 'manager'), ctrl.create);
router.put('/:id', authorize('admin', 'hr', 'manager'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
