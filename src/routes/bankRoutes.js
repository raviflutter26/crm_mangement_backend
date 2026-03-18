const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/ifsc/:code', bankController.getIFSCDetails);
router.post('/update', authorize('Admin', 'HR'), bankController.updateBankDetails);

module.exports = router;
