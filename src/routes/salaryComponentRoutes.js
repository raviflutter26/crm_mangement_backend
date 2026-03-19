const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salaryComponentController');

// GET all components (with optional ?category=earning|deduction|benefit|reimbursement)
router.get('/', ctrl.getAll);

// POST seed defaults (idempotent)
router.post('/seed', ctrl.seedDefaults);

// GET single component
router.get('/:id', ctrl.getById);

// POST create new component
router.post('/', ctrl.create);

// PUT update component
router.put('/:id', ctrl.update);

// PATCH toggle status
router.patch('/:id/toggle', ctrl.toggleStatus);

// DELETE component
router.delete('/:id', ctrl.remove);

module.exports = router;
