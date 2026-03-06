const Leave = require('../models/Leave');
const zohoPeopleService = require('../services/zohoPeopleService');

/**
 * @desc    Get all leaves
 * @route   GET /api/leaves
 */
exports.getLeaves = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employee, status, leaveType } = req.query;

        const query = {};
        if (employee) query.employee = employee;
        if (status) query.status = status;
        if (leaveType) query.leaveType = leaveType;

        const leaves = await Leave.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .populate('approvedBy', 'name email')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Leave.countDocuments(query);

        res.status(200).json({
            success: true,
            data: leaves,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Apply for leave
 * @route   POST /api/leaves
 */
exports.applyLeave = async (req, res, next) => {
    try {
        const leave = await Leave.create(req.body);
        res.status(201).json({ success: true, data: leave });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Approve/Reject leave
 * @route   PUT /api/leaves/:id/status
 */
exports.updateLeaveStatus = async (req, res, next) => {
    try {
        const { status, rejectionReason } = req.body;

        const leave = await Leave.findById(req.params.id);
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found.' });

        leave.status = status;
        if (status === 'Approved') {
            leave.approvedBy = req.user.id;
            leave.approvedAt = new Date();
        }
        if (status === 'Rejected') {
            leave.rejectionReason = rejectionReason;
        }
        await leave.save();

        res.status(200).json({ success: true, data: leave });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get leave balance
 * @route   GET /api/leaves/balance/:employeeId
 */
exports.getLeaveBalance = async (req, res, next) => {
    try {
        // Try from Zoho first
        try {
            const balance = await zohoPeopleService.getLeaveBalance(req.params.employeeId);
            return res.status(200).json({ success: true, data: balance, source: 'zoho' });
        } catch {
            // Fallback to local calculation
            const currentYear = new Date().getFullYear();
            const usedLeaves = await Leave.aggregate([
                {
                    $match: {
                        employee: req.params.employeeId,
                        status: 'Approved',
                        startDate: { $gte: new Date(`${currentYear}-01-01`) },
                    },
                },
                { $group: { _id: '$leaveType', totalDays: { $sum: '$totalDays' } } },
            ]);

            return res.status(200).json({ success: true, data: usedLeaves, source: 'local' });
        }
    } catch (error) {
        next(error);
    }
};
