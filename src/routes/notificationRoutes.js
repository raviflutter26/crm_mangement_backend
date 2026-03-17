const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

// Secure the route - only allow logged in users (and potentially only admins for manual emails)
router.post('/send-email', authenticate, authorize('admin', 'hr'), notificationController.sendManualEmail);

module.exports = router;
