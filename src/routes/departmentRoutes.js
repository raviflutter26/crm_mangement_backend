const express = require('express');
const {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

router.route('/')
    .get(getDepartments)
    .post(authorize('admin', 'hr'), createDepartment);

router.route('/:id')
    .put(authorize('admin', 'hr'), updateDepartment)
    .delete(authorize('admin'), deleteDepartment);

module.exports = router;
