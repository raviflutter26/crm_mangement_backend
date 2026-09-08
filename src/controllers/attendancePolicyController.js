const AttendancePolicy = require('../models/AttendancePolicy');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

/**
 * @desc    Get current attendance policy
 * @route   GET /api/attendance-policy
 */
exports.getPolicy = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        let policy = await AttendancePolicy.findOne({ isActive: true, organizationId: orgId });
        if (!policy) {
            // Create this organization's default on first read
            policy = await AttendancePolicy.create({ organizationId: orgId });
        }
        res.status(200).json({ success: true, data: policy });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update attendance policy
 * @route   PUT /api/attendance-policy
 */
exports.updatePolicy = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        let policy = await AttendancePolicy.findOne({ isActive: true, organizationId: orgId });
        if (!policy) {
            policy = new AttendancePolicy(withOrg(req, req.body));
        } else {
            Object.assign(policy, withOrg(req, req.body));
        }
        await policy.save();
        res.status(200).json({ success: true, data: policy, message: 'Policy updated successfully' });
    } catch (error) {
        next(error);
    }
};
