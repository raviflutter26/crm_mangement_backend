const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Stub for invitations to prevent 404s
// Pending invitations reveal who is being hired and at what role.
router.get('/', authenticate, authorize('owner', 'admin', 'hr'), (req, res) => {
    res.status(200).json({
        success: true,
        data: [] // Return empty array for now
    });
});

module.exports = router;
