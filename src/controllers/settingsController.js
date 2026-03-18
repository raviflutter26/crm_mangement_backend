const AttendanceConfig = require('../models/AttendanceConfig');
const { clearCache } = require('../services/configService');

/**
 * @desc    Get current attendance configuration
 * @route   GET /api/settings/attendance
 */
exports.getAttendanceSettings = async (req, res, next) => {
    try {
        let config = await AttendanceConfig.findOne({ isActive: true });
        if (!config) {
            config = await AttendanceConfig.create({});
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update global attendance configuration
 * @route   POST /api/settings/attendance
 */
exports.updateAttendanceSettings = async (req, res, next) => {
    try {
        let config = await AttendanceConfig.findOne({ isActive: true });
        
        if (!config) {
            config = new AttendanceConfig(req.body);
        } else {
            // Apply updates
            Object.assign(config, req.body);
        }

        await config.save();
        
        // Clear in-memory cache to ensure immediate effect
        clearCache();

        res.status(200).json({ 
            success: true, 
            data: config, 
            message: 'Attendance configuration updated successfully' 
        });
    } catch (error) {
        next(error);
    }
};
