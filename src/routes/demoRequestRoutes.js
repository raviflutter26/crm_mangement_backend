const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const router = express.Router();
const demoRequestController = require('../controllers/demoRequestController');
const { protect, authorize } = require('../middleware/auth');

/** Public lead form — capped per IP so it can't be used to spam the demo-requests inbox. */
const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
});

router.post('/', submitLimiter, demoRequestController.createDemoRequest);

router.get('/', protect, authorize('superadmin'), demoRequestController.getDemoRequests);
router.patch('/:id/status', protect, authorize('superadmin'), demoRequestController.updateDemoRequestStatus);

module.exports = router;
