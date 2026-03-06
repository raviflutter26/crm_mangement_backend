const express = require('express');
const router = express.Router();
const { authenticate: auth } = require('../middleware/auth');
const ctrl = require('../controllers/organizationController');

// Designations
router.get('/designations', auth, ctrl.getDesignations);
router.post('/designations', auth, ctrl.createDesignation);
router.put('/designations/:id', auth, ctrl.updateDesignation);
router.delete('/designations/:id', auth, ctrl.deleteDesignation);

// Branches
router.get('/branches', auth, ctrl.getBranches);
router.post('/branches', auth, ctrl.createBranch);
router.put('/branches/:id', auth, ctrl.updateBranch);
router.delete('/branches/:id', auth, ctrl.deleteBranch);

// Locations
router.get('/locations', auth, ctrl.getLocations);
router.post('/locations', auth, ctrl.createLocation);
router.put('/locations/:id', auth, ctrl.updateLocation);
router.delete('/locations/:id', auth, ctrl.deleteLocation);

// Shifts
router.get('/shifts', auth, ctrl.getShifts);
router.post('/shifts', auth, ctrl.createShift);
router.put('/shifts/:id', auth, ctrl.updateShift);
router.delete('/shifts/:id', auth, ctrl.deleteShift);

// Holidays
router.get('/holidays', auth, ctrl.getHolidays);
router.post('/holidays', auth, ctrl.createHoliday);
router.put('/holidays/:id', auth, ctrl.updateHoliday);
router.delete('/holidays/:id', auth, ctrl.deleteHoliday);

module.exports = router;
