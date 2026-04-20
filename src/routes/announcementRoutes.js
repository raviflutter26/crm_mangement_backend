const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Announcement = require('../models/Announcement');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(Announcement, 'Announcement', 'postedBy');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin', 'hr'), ctrl.create);
router.put('/:id', authorize('admin', 'hr'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
