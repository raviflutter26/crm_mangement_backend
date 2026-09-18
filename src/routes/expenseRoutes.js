const express = require('express');
const router = express.Router();
const { authenticate: auth, authorize, selfService, denySuperAdmin, authorizeBranch } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');
const ctrl = require('../controllers/expenseController');

router.use(auth, denySuperAdmin);
// Per-tenant module grant; narrows what authorize() below allows, never widens.
router.use(requireModule('expenses'));
// Any request naming a branchId in its body or query must hold it. A no-op when
// none is named, so it is safe on routes that never mention one. Route params
// are NOT visible to router-level middleware, so a future `/:branchId` route
// needs authorizeBranch('branchId') on the route itself — see branchRoutes.js.
router.use(authorizeBranch());

router.get('/', auth, selfService('an employee sees their own expenses'), ctrl.getExpenses);
router.post('/', auth, selfService('an employee files their own expense'), ctrl.createExpense);
router.put('/:id', auth, selfService('an employee edits their own unapproved expense'), ctrl.updateExpense);
router.delete('/:id', auth, authorize('owner', 'admin', 'hr', 'manager'), ctrl.deleteExpense);
// Approving your own expense is the thing this route must not allow.
router.patch('/:id/status', auth, authorize('owner', 'admin', 'hr', 'manager'), ctrl.updateExpenseStatus);

module.exports = router;
