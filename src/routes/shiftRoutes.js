const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', authorize('Admin', 'HR'), shiftController.createShift);
router.get('/', shiftController.getShifts);
router.put('/:id', authorize('Admin', 'HR'), shiftController.updateShift);
router.delete('/:id', authorize('Admin', 'HR'), shiftController.deleteShift);

module.exports = router;
