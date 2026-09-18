const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const EmployeeDocument = require('../models/EmployeeDocument');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const { uploadTo } = require('../middleware/upload');
const docCtrl = require('../controllers/employeeDocumentController');
const ctrl = createCrudController(EmployeeDocument, 'EmployeeDocument', 'employee uploadedBy');

router.use(authenticate);
router.get('/', authorize('owner', 'admin', 'hr'), ctrl.getAll);
router.get('/my', selfService('own documents'), ctrl.getMyRecords);
router.get('/:id', selfService('tenant-scoped fetch of a single document'), ctrl.getById);
router.post('/', authorize('owner', 'admin', 'hr'), ctrl.create);
router.post('/upload', selfService('an employee uploads their own document'), uploadTo('employee-documents').single('file'), docCtrl.upload);
router.put('/:id', authorize('owner', 'admin', 'hr'), ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), docCtrl.remove);

module.exports = router;
