const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/expenseController');

router.get('/', auth, ctrl.getExpenses);
router.post('/', auth, ctrl.createExpense);
router.put('/:id', auth, ctrl.updateExpense);
router.delete('/:id', auth, ctrl.deleteExpense);
router.patch('/:id/status', auth, ctrl.updateExpenseStatus);

module.exports = router;
