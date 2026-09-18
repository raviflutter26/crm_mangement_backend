const express = require('express');
const router = express.Router();
const statutoryController = require('../controllers/statutoryController');
const { authenticate, authorize, selfService } = require('../middleware/auth');

// Global Config
router.get('/config', authenticate, authorize('owner', 'admin', 'hr'), statutoryController.getStatutoryConfig);
router.put('/config/epf', authenticate, authorize('admin', 'hr'), statutoryController.updateEPFConfig);
router.put('/config/esi', authenticate, authorize('admin', 'hr'), statutoryController.updateESIConfig);
router.put('/config/pt', authenticate, authorize('admin', 'hr'), statutoryController.updatePTConfig);
router.put('/config/lwf', authenticate, authorize('admin', 'hr'), statutoryController.updateLWFConfig);
router.put('/config/bonus', authenticate, authorize('admin', 'hr'), statutoryController.updateBonusConfig);

// Employee settings
// An employee may read only their own; the handler enforces self and tenant.
router.get('/employee/:employeeId', authenticate, selfService('own statutory details; handler checks self and tenant'), statutoryController.getEmployeeStatutory);
router.put('/employee/:employeeId', authenticate, authorize('admin', 'hr'), statutoryController.updateEmployeeStatutory);

// Calculations & Slabs
// EPF Calculation Preview
router.post('/epf/calculate', (req, res) => {
    const { pfWage, config } = req.body;
    const { calculateEPF } = require('../utils/statutoryCalc');
    const result = calculateEPF(pfWage || 0, config || {});
    res.json({ success: true, data: result });
});
router.get('/pt/slabs/:state', authenticate, selfService('professional tax slabs are public reference data'), statutoryController.getPTSlabs);

module.exports = router;
