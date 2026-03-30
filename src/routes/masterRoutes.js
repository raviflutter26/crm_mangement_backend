const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

/**
 * Public routes for master data
 */
router.get('/industries', masterController.getIndustries);

module.exports = router;
