const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/states', locationController.getStates);
router.get('/cities', locationController.getCities);

// Organization Structure Locations
router.get('/', locationController.getLocations);
router.post('/', authorize('Admin', 'HR'), locationController.createLocation);
router.put('/:id', authorize('Admin', 'HR'), locationController.updateLocation);
router.delete('/:id', authorize('Admin', 'HR'), locationController.deleteLocation);

module.exports = router;
