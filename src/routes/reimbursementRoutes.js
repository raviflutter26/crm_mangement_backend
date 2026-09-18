const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Reimbursement = require('../models/Reimbursement');
const { authenticate, authorize, selfService } = require('../middleware/auth');
const ctrl = createCrudController(Reimbursement, 'Reimbursement', 'employee approvedBy');

router.use(authenticate);
router.get('/', selfService('employee-owned rows, tenant-scoped'), ctrl.getAll);
router.get('/my', selfService('employee-owned rows, tenant-scoped'), ctrl.getMyRecords);
router.get('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.getById);
router.post('/', selfService('employee-owned rows, tenant-scoped'), ctrl.create);
router.put('/:id', selfService('employee-owned rows, tenant-scoped'), ctrl.update);
router.patch('/:id/approve', authorize('admin', 'hr', 'manager'), async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();
        const scopeFilter = role === 'superadmin' ? {} : { organizationId: req.user.organizationId };
        const item = await Reimbursement.findOneAndUpdate({ _id: req.params.id, ...scopeFilter }, { status: req.body.status || 'Approved', approvedBy: req.user._id }, { new: true });
        if (!item) return res.status(404).json({ success: false, message: 'Reimbursement not found' });
        res.json({ success: true, data: item });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
