const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { authenticate, authorize, selfService } = require('../middleware/auth');

router.use(authenticate);

router.get('/ifsc/:code', selfService('public IFSC lookup'), bankController.getIFSCDetails);
router.post('/update', authorize('Admin', 'HR'), bankController.updateBankDetails);

module.exports = router;
