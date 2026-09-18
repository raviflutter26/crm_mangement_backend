const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salaryComponentController');
const { authenticate, authorize, denySuperAdmin } = require('../middleware/auth');

router.use(authenticate, denySuperAdmin);

// GET all components (with optional ?category=earning|deduction|benefit|reimbursement)
router.get('/', authorize('owner', 'admin', 'hr'), ctrl.getAll);

// POST seed defaults (idempotent)
router.post('/seed', authorize('owner', 'admin'), ctrl.seedDefaults);

// GET single component
router.get('/:id', authorize('owner', 'admin', 'hr'), ctrl.getById);

// POST create new component
router.post('/', authorize('owner', 'admin', 'hr'), ctrl.create);

// PUT update component
router.put('/:id', authorize('owner', 'admin', 'hr'), ctrl.update);

// PATCH toggle status
router.patch('/:id/toggle', authorize('owner', 'admin', 'hr'), ctrl.toggleStatus);

// DELETE component
router.delete('/:id', authorize('owner', 'admin'), ctrl.remove);

module.exports = router;
