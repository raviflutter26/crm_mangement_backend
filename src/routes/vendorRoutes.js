const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Vendor = require('../models/Vendor');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(Vendor, 'Vendor');

router.use(authenticate);
router.get('/', selfService('vendor list is visible across the tenant'), ctrl.getAll);
router.get('/:id', selfService('vendor list is visible across the tenant'), ctrl.getById);
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
