const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Stub for invitations to prevent 404s
router.get('/', authenticate, (req, res) => {
    res.status(200).json({
        success: true,
        data: [] // Return empty array for now
    });
});

module.exports = router;
