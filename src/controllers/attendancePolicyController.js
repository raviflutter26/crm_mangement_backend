const AttendancePolicy = require('../models/AttendancePolicy');

/**
 * @desc    Get current attendance policy
 * @route   GET /api/attendance-policy
 */
exports.getPolicy = async (req, res, next) => {
    try {
        let policy = await AttendancePolicy.findOne({ isActive: true });
        if (!policy) {
            // Create default if none exists
            policy = await AttendancePolicy.create({});
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
        let policy = await AttendancePolicy.findOne({ isActive: true });
        if (!policy) {
            policy = new AttendancePolicy(req.body);
        } else {
            Object.assign(policy, req.body);
        }
        await policy.save();
        res.status(200).json({ success: true, data: policy, message: 'Policy updated successfully' });
    } catch (error) {
        next(error);
    }
};
