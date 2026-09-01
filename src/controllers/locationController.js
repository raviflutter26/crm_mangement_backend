const axios = require('axios');
const Location = require('../models/Location');
const indiaStatesDistricts = require('../data/indiaStatesDistricts');

// General-purpose cities lookup for non-India countries (India uses the bundled
// static dataset instead — see ../data/indiaStatesDistricts.js).
async function fetchCitiesFromCountriesNow(country, stateName) {
    const response = await axios.post('https://countriesnow.space/api/v0.1/countries/state/cities', {
        country,
        state: stateName
    });
    if (response.data && !response.data.error && Array.isArray(response.data.data)) {
        return Array.from(new Set(response.data.data));
    }
    return null;
}

/**
 * @desc    Get states for a country
 * @route   GET /api/locations/states
 */
exports.getStates = async (req, res, next) => {
    try {
        const country = req.query.country || 'India';

        if (country.toLowerCase() === 'india') {
            return res.status(200).json({
                success: true,
                data: Object.keys(indiaStatesDistricts).map(name => ({ name }))
            });
        }

        // Fallback for other countries
        const response = await axios.post('https://countriesnow.space/api/v0.1/countries/states', {
            country: country
        });

        if (response.data && !response.data.error) {
            return res.status(200).json({
                success: true,
                data: response.data.data.states
            });
        }

        res.status(400).json({
            success: false,
            message: response.data.msg || 'Unable to load states.'
        });
    } catch (error) {
        console.error('Error fetching states:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching states.'
        });
    }
};

/**
 * @desc    Get districts (cities) for a state
 * @route   GET /api/locations/cities
 */
exports.getCities = async (req, res, next) => {
    try {
        const country = req.query.country || 'India';
        const stateName = req.query.state;

        if (!stateName) {
            return res.status(400).json({
                success: false,
                message: 'State is required.'
            });
        }

        if (country.toLowerCase() === 'india') {
            const matchedState = Object.keys(indiaStatesDistricts)
                .find(name => name.toLowerCase() === stateName.toLowerCase());

            if (!matchedState) {
                return res.status(404).json({
                    success: false,
                    message: 'State not found in India mapping.'
                });
            }

            return res.status(200).json({
                success: true,
                data: indiaStatesDistricts[matchedState]
            });
        }

        // Non-India countries
        const cities = await fetchCitiesFromCountriesNow(country, stateName);
        if (cities) {
            return res.status(200).json({
                success: true,
                data: cities
            });
        }

        res.status(400).json({
            success: false,
            message: 'No data available for this state.'
        });
    } catch (error) {
        console.error('Error fetching cities/districts:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error while fetching cities/districts.'
        });
    }
};

// --- Actual Location CRUD for Organization Structure ---

/**
 * @desc    Get all locations
 * @route   GET /api/locations
 */
exports.getLocations = async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const filter = { isActive: true };
        if (organizationId) filter.organizationId = organizationId;

        const locations = await Location.find(filter);
        res.status(200).json({
            success: true,
            data: locations
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new location
 * @route   POST /api/locations
 */
exports.createLocation = async (req, res, next) => {
    try {
        const { organizationId } = req.body;
        // Fallback to user's org if not provided
        const orgId = organizationId || req.user?.organizationId;
        
        const location = await Location.create({ ...req.body, organizationId: orgId });
        res.status(201).json({
            success: true,
            data: location
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update location
 * @route   PUT /api/locations/:id
 */
exports.updateLocation = async (req, res, next) => {
    try {
        const location = await Location.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
        res.status(200).json({
            success: true,
            data: location
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete location (Soft delete)
 */
exports.deleteLocation = async (req, res, next) => {
    try {
        const location = await Location.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
        res.status(200).json({
            success: true,
            message: 'Location deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
