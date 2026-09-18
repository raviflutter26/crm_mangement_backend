const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Training = require('../models/Training');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const trainingCtrl = require('../controllers/trainingController');
const ctrl = createCrudController(Training, 'Training');

router.use(authenticate);
router.get('/', selfService('employees enrol in and complete their own training'), ctrl.getAll);
router.get('/:id', selfService('employees enrol in and complete their own training'), ctrl.getById);
router.post('/', authorize('admin', 'hr'), ctrl.create);
router.put('/:id', authorize('admin', 'hr'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.delete);
router.post('/:id/enroll', selfService('employees enrol in and complete their own training'), trainingCtrl.enroll);
router.post('/:id/complete', selfService('employees enrol in and complete their own training'), trainingCtrl.complete);

module.exports = router;
