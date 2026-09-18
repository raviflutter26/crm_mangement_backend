const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Certification = require('../models/Certification');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(Certification, 'Certification', 'employee');

router.use(authenticate);
router.get('/', selfService('employee-owned rows, tenant-scoped'), ctrl.getAll);
router.get('/my', selfService('employee-owned rows, tenant-scoped'), ctrl.getMyRecords);
router.get('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.getById);
router.post('/', authorize('admin', 'hr'), ctrl.create);
router.put('/:id', authorize('admin', 'hr'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
