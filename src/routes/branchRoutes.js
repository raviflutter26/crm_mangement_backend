const express = require('express');
const router = express.Router();
const {
    getBranches, getBranch, createBranch, updateBranch, deleteBranch, getBranchScope,
} = require('../controllers/branchController');
const { authenticate, authorize, authorizeBranch, selfService } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleAccess');

router.use(authenticate);
router.use(requireModule('organization'));

// Reading the branch list is open to every role — a branch switcher, a
// department form and an employee's own profile all need it, and the filter
// already confines the result to branches the caller holds.
// authorizeBranch goes on each route rather than router.use(): route params are
// not populated for router-level middleware, so a `router.use(authorizeBranch('id'))`
// would silently see no branch id and pass everything through.
router.get('/', selfService('branch list confined to the branches the caller holds'), getBranches);
router.get('/:id', selfService('branch list confined to the branches the caller holds'), authorizeBranch('id'), getBranch);
router.get('/:id/scope', selfService('branch list confined to the branches the caller holds'), authorizeBranch('id'), getBranchScope);

// Creating and removing branches changes the shape of the organization, so it
// sits with the owner. Editing one is a branch-level act, so a branch admin may
// do it — for the branches they hold, which authorizeBranch above enforces.
router.post('/', authorize('owner'), createBranch);
router.put('/:id', authorizeBranch('id'), authorize('owner', 'admin'), updateBranch);
router.delete('/:id', authorizeBranch('id'), authorize('owner'), deleteBranch);

module.exports = router;
