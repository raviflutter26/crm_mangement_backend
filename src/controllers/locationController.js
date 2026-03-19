const axios = require('axios');
const Location = require('../models/Location');

// In-memory cache for states and districts
const stateCache = new Map();
const districtCache = new Map();

// Helper to get state ID from CoWin API
async function getCoWinStates() {
    if (stateCache.has('india-states')) return stateCache.get('india-states');
    
    try {
        const response = await axios.get('https://cdn-api.co-vin.in/api/v2/admin/location/states', {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.cowin.gov.in/',
                'Origin': 'https://www.cowin.gov.in'
            }
        });
        if (response.data && response.data.states) {
            console.log(`Fetched ${response.data.states.length} states from CoWin`);
            stateCache.set('india-states', response.data.states);
            return response.data.states;
        }
    } catch (error) {
        console.error('CoWin States API Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
        
        // Final Fallback: Hardcoded list if API and cache fail
        console.log('Using hardcoded fallback for Indian States');
        const fallbackStates = [
            { state_id: 1, state_name: "Andaman and Nicobar Islands" },
            { state_id: 2, state_name: "Andhra Pradesh" },
            { state_id: 3, state_name: "Arunachal Pradesh" },
            { state_id: 4, state_name: "Assam" },
            { state_id: 5, state_name: "Bihar" },
            { state_id: 6, state_name: "Chandigarh" },
            { state_id: 7, state_name: "Chhattisgarh" },
            { state_id: 8, state_name: "Dadra and Nagar Haveli and Daman and Diu" },
            { state_id: 9, state_name: "Delhi" },
            { state_id: 10, state_name: "Goa" },
            { state_id: 11, state_name: "Gujarat" },
            { state_id: 12, state_name: "Haryana" },
            { state_id: 13, state_name: "Himachal Pradesh" },
            { state_id: 14, state_name: "Jammu and Kashmir" },
            { state_id: 15, state_name: "Jharkhand" },
            { state_id: 16, state_name: "Karnataka" },
            { state_id: 17, state_name: "Kerala" },
            { state_id: 18, state_name: "Ladakh" },
            { state_id: 19, state_name: "Lakshadweep" },
            { state_id: 20, state_name: "Madhya Pradesh" },
            { state_id: 21, state_name: "Maharashtra" },
            { state_id: 22, state_name: "Manipur" },
            { state_id: 23, state_name: "Meghalaya" },
            { state_id: 24, state_name: "Mizoram" },
            { state_id: 25, state_name: "Nagaland" },
            { state_id: 26, state_name: "Odisha" },
            { state_id: 27, state_name: "Puducherry" },
            { state_id: 28, state_name: "Punjab" },
            { state_id: 29, state_name: "Rajasthan" },
            { state_id: 30, state_name: "Sikkim" },
            { state_id: 31, state_name: "Tamil Nadu" },
            { state_id: 32, state_name: "Telangana" },
            { state_id: 33, state_name: "Tripura" },
            { state_id: 34, state_name: "Uttar Pradesh" },
            { state_id: 35, state_name: "Uttarakhand" },
            { state_id: 36, state_name: "West Bengal" }
        ];
        stateCache.set('india-states', fallbackStates);
        return fallbackStates;
    }
    return [];
}

/**
 * @desc    Get states for a country
 * @route   GET /api/locations/states
 */
exports.getStates = async (req, res, next) => {
    try {
        const country = req.query.country || 'India';
        
        if (country.toLowerCase() === 'india') {
            const states = await getCoWinStates();
            return res.status(200).json({
                success: true,
                data: states.map(s => ({ name: s.state_name, state_code: s.state_id }))
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
            // Find state ID
            const states = await getCoWinStates();
            const stateObj = states.find(s => s.state_name.toLowerCase() === stateName.toLowerCase());
            
            if (!stateObj) {
                return res.status(404).json({
                    success: false,
                    message: 'State not found in India mapping.'
                });
            }

            const stateId = stateObj.state_id;
            const cacheKey = `india-districts-${stateId}`;

            if (districtCache.has(cacheKey)) {
                return res.status(200).json({
                    success: true,
                    data: districtCache.get(cacheKey)
                });
            }

            try {
                const response = await axios.get(`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${stateId}`, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/plain, */*',
                        'Referer': 'https://www.cowin.gov.in/',
                        'Origin': 'https://www.cowin.gov.in'
                    }
                });

                if (response.data && response.data.districts) {
                    console.log(`Fetched ${response.data.districts.length} districts for state ${stateName}`);
                    const districts = response.data.districts.map(d => d.district_name);
                    districtCache.set(cacheKey, districts);
                    return res.status(200).json({
                        success: true,
                        data: districts
                    });
                }
            } catch (distErr) {
                console.error(`CoWin Districts API Error for state ${stateName}:`, distErr.message);
                if (stateName.toLowerCase() === 'tamil nadu' || stateId === 31) {
                    console.log('Using hardcoded fallback for Tamil Nadu districts');
                    const tnDistricts = ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"];
                    districtCache.set(cacheKey, tnDistricts);
                    return res.status(200).json({ success: true, data: tnDistricts });
                }
                throw distErr;
            }
        }

        // Fallback or other country logic
        const response = await axios.post('https://countriesnow.space/api/v0.1/countries/state/cities', {
            country: country,
            state: stateName
        });

        if (response.data && !response.data.error) {
            const cities = Array.from(new Set(response.data.data)); // Unique cities
            return res.status(200).json({
                success: true,
                data: cities
            });
        }

        res.status(400).json({
            success: false,
            message: response.data.msg || 'No data available for this state.'
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
        const locations = await Location.find({ isActive: true });
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
        const location = await Location.create(req.body);
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
