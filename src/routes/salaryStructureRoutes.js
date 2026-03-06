const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/salaryStructureController');

router.get('/', authenticate, ctrl.getStructures);
router.post('/', authenticate, authorize('admin', 'hr'), ctrl.createStructure);
router.put('/:id', authenticate, authorize('admin', 'hr'), ctrl.updateStructure);
router.delete('/:id', authenticate, authorize('admin', 'hr'), ctrl.deleteStructure);

module.exports = router;
