const express = require('express');
const router = express.Router();
const { authenticate, authorize, selfService } = require('../middleware/auth');
const { uploadTo } = require('../middleware/upload');
const ctrl = require('../controllers/taxDocumentController');

router.use(authenticate);
router.get('/', authorize('owner', 'admin', 'hr'), ctrl.getAll);
router.get('/my', selfService('own tax documents'), ctrl.getMyRecords);
router.post('/upload', selfService('an employee uploads their own investment declaration'), uploadTo('tax-documents').single('file'), ctrl.upload);
router.put('/:id', authorize('owner', 'admin', 'hr'), ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), ctrl.remove);

module.exports = router;
