const AttendanceConfig = require('../models/AttendanceConfig');
const { clearCache } = require('../services/configService');
const { withOrg, requireOrg } = require('../utils/tenancy');

/**
 * @desc    Get this organization's attendance configuration
 * @route   GET /api/settings/attendance
 */
exports.getAttendanceSettings = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        let config = await AttendanceConfig.findOne({ isActive: true, organizationId: orgId });
        if (!config) {
            config = await AttendanceConfig.create({ organizationId: orgId });
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update this organization's attendance configuration
 * @route   POST /api/settings/attendance
 */
exports.updateAttendanceSettings = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        let config = await AttendanceConfig.findOne({ isActive: true, organizationId: orgId });

        if (!config) {
            config = new AttendanceConfig(withOrg(req, req.body));
        } else {
            // Apply updates
            Object.assign(config, withOrg(req, req.body));
        }

        await config.save();

        // Clear this organization's cache to ensure immediate effect
        clearCache(orgId);

        res.status(200).json({
            success: true,
            data: config,
            message: 'Attendance configuration updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
