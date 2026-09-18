const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Incident = require('../models/Incident');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(Incident, 'Incident', 'reportedBy investigatedBy');

router.use(authenticate);
router.get('/', selfService('anyone may report and read incidents in their tenant'), ctrl.getAll);
router.get('/my', selfService('anyone may report and read incidents in their tenant'), ctrl.getMyRecords);
router.get('/:id', selfService('anyone may report and read incidents in their tenant'), ctrl.getById);
router.post('/', selfService('anyone may report and read incidents in their tenant'), ctrl.create);
router.put('/:id', selfService('anyone may report and read incidents in their tenant'), ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), ctrl.delete);

module.exports = router;
