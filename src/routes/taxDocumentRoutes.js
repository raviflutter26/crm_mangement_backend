const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadTo } = require('../middleware/upload');
const ctrl = require('../controllers/taxDocumentController');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.post('/upload', uploadTo('tax-documents').single('file'), ctrl.upload);
router.put('/:id', ctrl.update);
router.delete('/:id', authorize('admin', 'hr'), ctrl.remove);

module.exports = router;
