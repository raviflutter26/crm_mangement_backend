/**
 * Master Controller
 * Handles static and master data for the application.
 */

// Static list of industries for onboarding
const industries = [
    "Information Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Manufacturing",
    "Retail",
    "Real Estate",
    "Logistics",
    "Automotive",
    "Hospitality",
    "Construction",
    "Media & Entertainment",
    "Agriculture",
    "Pharma",
    "Consulting"
];

/**
 * @desc    Get all industries
 * @route   GET /api/master/industries
 * @access  Public
 */
exports.getIndustries = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Industries fetched successfully',
            data: industries
        });
    } catch (error) {
        next(error);
    }
};
