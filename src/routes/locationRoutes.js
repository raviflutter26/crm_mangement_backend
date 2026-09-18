const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, authorize, selfService } = require('../middleware/auth');

router.use(authenticate);

router.get('/states', selfService('state and city reference data'), locationController.getStates);
router.get('/cities', selfService('state and city reference data'), locationController.getCities);

// Organization Structure Locations
router.get('/', selfService('state and city reference data'), locationController.getLocations);
router.post('/', authorize('Admin', 'HR'), locationController.createLocation);
router.put('/:id', authorize('Admin', 'HR'), locationController.updateLocation);
router.delete('/:id', authorize('Admin', 'HR'), locationController.deleteLocation);

module.exports = router;
