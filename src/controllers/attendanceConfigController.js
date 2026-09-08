const AttendanceConfig = require('../models/AttendanceConfig');
const { clearCache } = require('../services/configService');
const { requireOrg } = require('../utils/tenancy');

/**
 * @desc    Get this organization's attendance configuration
 * @route   GET /api/attendance-config
 * @access  All authenticated users
 */
exports.getConfig = async (req, res, next) => {
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
 * @route   PUT /api/attendance-config
 * @access  Admin, HR
 */
exports.updateConfig = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const allowed = [
            'startTime', 'endTime', 'workingHours', 'graceMinutes',
            'latePolicyEnabled', 'maxLateDaysPerMonth', 'lateMarkType',
            'permissionEnabled', 'maxPermissionCount', 'maxPermissionHours'
        ];

        const updates = {};
        allowed.forEach(key => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        let config = await AttendanceConfig.findOne({ isActive: true, organizationId: orgId });
        if (!config) {
            config = await AttendanceConfig.create({ ...updates, organizationId: orgId });
        } else {
            Object.assign(config, updates);
            await config.save();
        }

        // Invalidate this organization's cache so changes take effect immediately
        clearCache(orgId);

        res.status(200).json({
            success: true,
            data: config,
            message: 'Attendance settings updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
