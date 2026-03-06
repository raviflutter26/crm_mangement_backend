const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', employeeController.getStats);
router.post('/sync', authorize('admin', 'hr'), employeeController.syncFromZoho);

router.route('/')
    .get(employeeController.getEmployees)
    .post(authorize('admin', 'hr'), employeeController.createEmployee);

router.route('/:id')
    .get(employeeController.getEmployee)
    .put(authorize('admin', 'hr'), employeeController.updateEmployee)
    .delete(authorize('admin'), employeeController.deleteEmployee);

module.exports = router;
