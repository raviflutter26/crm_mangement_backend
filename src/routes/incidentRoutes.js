const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Incident = require('../models/Incident');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(Incident, 'Incident', 'reportedBy investigatedBy');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), ctrl.delete);

module.exports = router;
