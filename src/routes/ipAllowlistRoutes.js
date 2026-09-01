const express = require('express');
const router = express.Router();
const createCrudController = require('../controllers/crudFactory');
const IpAllowlistEntry = require('../models/IpAllowlistEntry');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = createCrudController(IpAllowlistEntry, 'IpAllowlistEntry', 'addedBy');

router.use(authenticate, authorize('admin'));

router.get('/', ctrl.getAll);
router.post('/', (req, res, next) => {
    req.body.addedBy = req.user._id;
    next();
}, ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);

module.exports = router;
