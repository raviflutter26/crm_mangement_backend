const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', employeeController.getStats);
router.post('/sync', authorize('admin', 'hr'), employeeController.syncFromZoho);
router.get('/managers', employeeController.getManagers);

router.route('/')
    .get(employeeController.getEmployees)
    .post(authorize('admin', 'hr'), employeeController.createEmployee);

router.route('/:id')
    .get(employeeController.getEmployee)
    .put(authorize('admin', 'hr'), employeeController.updateEmployee)
    .delete(authorize('admin'), employeeController.deleteEmployee);

router.put('/:id/bank', authorize('admin', 'hr'), employeeController.updateBankDetails);
router.put('/:id/salary-structure', authorize('admin', 'hr'), employeeController.updateSalaryStructure);

module.exports = router;
