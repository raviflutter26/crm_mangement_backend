const AttendanceConfig = require('../models/AttendanceConfig');
const { clearCache } = require('../services/configService');

/**
 * @desc    Get global attendance configuration
 * @route   GET /api/attendance-config
 * @access  All authenticated users
 */
exports.getConfig = async (req, res, next) => {
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
 * @route   PUT /api/attendance-config
 * @access  Admin, HR
 */
exports.updateConfig = async (req, res, next) => {
    try {
        const allowed = [
            'startTime', 'endTime', 'workingHours', 'graceMinutes',
            'latePolicyEnabled', 'maxLateDaysPerMonth', 'lateMarkType',
            'permissionEnabled', 'maxPermissionCount', 'maxPermissionHours'
        ];

        const updates = {};
        allowed.forEach(key => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        let config = await AttendanceConfig.findOne({ isActive: true });
        if (!config) {
            config = await AttendanceConfig.create({ ...updates });
        } else {
            Object.assign(config, updates);
            await config.save();
        }

        // Invalidate in-memory cache so changes take effect immediately
        clearCache();

        res.status(200).json({
            success: true,
            data: config,
            message: 'Attendance settings updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
