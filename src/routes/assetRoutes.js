const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/assetController');

router.get('/', auth, ctrl.getAssets);
router.post('/', auth, ctrl.createAsset);
router.put('/:id', auth, ctrl.updateAsset);
router.delete('/:id', auth, ctrl.deleteAsset);
router.patch('/:id/assign', auth, ctrl.assignAsset);
router.patch('/:id/return', auth, ctrl.returnAsset);

module.exports = router;
