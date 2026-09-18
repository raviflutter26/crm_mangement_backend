const express = require('express');
const router = express.Router();
const { authenticate: auth, authorize, selfService } = require('../middleware/auth');
const ctrl = require('../controllers/assetController');

router.get('/', auth, selfService('an employee sees the assets issued to them'), ctrl.getAssets);
router.post('/', auth, authorize('owner', 'admin', 'hr'), ctrl.createAsset);
router.put('/:id', auth, authorize('owner', 'admin', 'hr'), ctrl.updateAsset);
router.delete('/:id', auth, authorize('owner', 'admin'), ctrl.deleteAsset);
router.patch('/:id/assign', auth, authorize('owner', 'admin', 'hr'), ctrl.assignAsset);
router.patch('/:id/return', auth, authorize('owner', 'admin', 'hr'), ctrl.returnAsset);

module.exports = router;
