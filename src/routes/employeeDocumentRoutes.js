const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const EmployeeDocument = require('../models/EmployeeDocument');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadTo } = require('../middleware/upload');
const docCtrl = require('../controllers/employeeDocumentController');
const ctrl = createCrudController(EmployeeDocument, 'EmployeeDocument', 'employee uploadedBy');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.post('/upload', uploadTo('employee-documents').single('file'), docCtrl.upload);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), docCtrl.remove);

module.exports = router;
