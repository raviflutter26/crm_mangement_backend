const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const PPERecord = require('../models/PPERecord');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(PPERecord, 'PPERecord', 'employee');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin', 'hr', 'manager'), ctrl.create);
router.put('/:id', authorize('admin', 'hr', 'manager'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
