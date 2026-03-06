const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/balance/:employeeId', leaveController.getLeaveBalance);
router.put('/:id/status', authorize('admin', 'hr', 'manager'), leaveController.updateLeaveStatus);

router.route('/')
    .get(leaveController.getLeaves)
    .post(leaveController.applyLeave);

module.exports = router;
