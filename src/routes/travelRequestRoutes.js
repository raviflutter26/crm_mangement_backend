const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const TravelRequest = require('../models/TravelRequest');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(TravelRequest, 'TravelRequest', 'employee approvedBy');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/my', ctrl.getMyRecords);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/approve', authorize('admin', 'manager'), async (req, res) => {
    try {
        const item = await TravelRequest.findByIdAndUpdate(req.params.id, { status: 'Approved', approvedBy: req.user._id }, { new: true });
        res.json({ success: true, data: item });
    } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
router.delete('/:id', authorize('admin'), ctrl.delete);

module.exports = router;
