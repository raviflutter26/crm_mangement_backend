const express = require('express');
const router = express.Router();
const statutoryController = require('../controllers/statutoryController');
const { authenticate, authorize } = require('../middleware/auth'); // Fixed path and exports

// Global Config
router.get('/config', authenticate, statutoryController.getStatutoryConfig);
router.put('/config/epf', authenticate, authorize('admin', 'hr'), statutoryController.updateEPFConfig);
router.put('/config/esi', authenticate, authorize('admin', 'hr'), statutoryController.updateESIConfig);
router.put('/config/pt', authenticate, authorize('admin', 'hr'), statutoryController.updatePTConfig);
router.put('/config/lwf', authenticate, authorize('admin', 'hr'), statutoryController.updateLWFConfig);
router.put('/config/bonus', authenticate, authorize('admin', 'hr'), statutoryController.updateBonusConfig);

// Employee settings
router.get('/employee/:employeeId', authenticate, statutoryController.getEmployeeStatutory);
router.put('/employee/:employeeId', authenticate, authorize('admin', 'hr'), statutoryController.updateEmployeeStatutory);

// Calculations & Slabs
// EPF Calculation Preview
router.post('/epf/calculate', (req, res) => {
    const { pfWage, config } = req.body;
    const { calculateEPF } = require('../utils/statutoryCalc');
    const result = calculateEPF(pfWage || 0, config || {});
    res.json({ success: true, data: result });
});
router.get('/pt/slabs/:state', authenticate, statutoryController.getPTSlabs);

module.exports = router;
