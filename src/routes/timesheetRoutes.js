const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const Timesheet = require('../models/Timesheet');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(Timesheet, 'Timesheet', 'employee approvedBy');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/approve', authorize('admin', 'hr', 'manager'), async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();
        const scopeFilter = role === 'superadmin' ? {} : { organizationId: req.user.organizationId };
        const item = await Timesheet.findOneAndUpdate({ _id: req.params.id, ...scopeFilter }, { status: req.body.status || 'Approved', approvedBy: req.user._id }, { new: true });
        if (!item) return res.status(404).json({ success: false, message: 'Timesheet not found' });
        res.json({ success: true, data: item });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
