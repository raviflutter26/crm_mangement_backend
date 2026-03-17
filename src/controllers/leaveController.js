const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const zohoPeopleService = require('../services/zohoPeopleService');
const { sendEmail } = require('../services/emailService');

/**
 * @desc    Get all leaves
 * @route   GET /api/leaves
 */
exports.getLeaves = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employee, status, leaveType } = req.query;

        const query = {};
        
        // Enforce role-based access
        if (req.user) {
            if (req.user.role === 'employee') {
                const emp = await Employee.findOne({ email: req.user.email });
                if (!emp) return res.status(403).json({ success: false, message: 'Employee profile not found.' });
                query.employee = emp._id;
            } else if (req.user.role === 'manager') {
                const allowedEmps = await Employee.find({ 
                    $or: [{ reportingManager: req.user.name }, { email: req.user.email }] 
                }).select('_id');
                const allowedIds = allowedEmps.map(e => e._id);
                
                if (employee) {
                    if (!allowedIds.some(id => id.toString() === employee.toString())) {
                        return res.status(403).json({ success: false, message: 'Unauthorized employee query.' });
                    }
                    query.employee = employee;
                } else {
                    query.employee = { $in: allowedIds };
                }
            } else if (employee) {
                // HR or admin
                query.employee = employee;
            }
        }

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

        // Fetch employee and manager details for email
        const employee = await Employee.findById(leave.employee).populate('reportingManager');
        if (employee && employee.reportingManager) {
            await sendEmail({
                to: employee.reportingManager.email,
                subject: `New Leave Request from ${employee.firstName} ${employee.lastName}`,
                template: 'leaveRequestNotification',
                data: {
                    managerName: `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    leaveType: leave.leaveType,
                    startDate: leave.startDate.toDateString(),
                    endDate: leave.endDate.toDateString(),
                    days: leave.totalDays,
                    reason: leave.reason,
                    dashboardUrl: `${process.env.WEBSITE_URL}/dashboard/leaves`
                }
            });
        }

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

        // Notify employee about status update
        const employee = await Employee.findById(leave.employee);
        if (employee) {
            const template = status === 'Approved' ? 'leaveApproved' : 'leaveRejected';
            await sendEmail({
                to: employee.email,
                subject: `Leave Request ${status} - ${process.env.COMPANY_NAME || 'HRMS'}`,
                template: template,
                data: {
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    startDate: leave.startDate.toDateString(),
                    endDate: leave.endDate.toDateString(),
                    reason: leave.reason,
                    managerNote: rejectionReason || 'Your leave request has been processed.',
                    status: status
                }
            });
        }

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
