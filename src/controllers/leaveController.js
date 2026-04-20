const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const LeaveBalance = require('../models/LeaveBalance');
const leaveService = require('../services/leaveService');
const { sendEmail } = require('../services/emailService');

/**
 * @desc    Apply for leave
 * @route   POST /api/leaves
 */
exports.applyLeave = async (req, res, next) => {
    try {
        const { leaveType, fromDate, toDate, reason, halfDay, documentUrl } = req.body;
        
        // 1. Resolve Employee & Org
        let employeeId = req.user.id;
        let employee;
        if (req.user.role === 'Employee') {
            employee = await Employee.findOne({ email: req.user.email }).populate('organizationId');
            if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found.' });
            employeeId = employee._id;
            req.orgId = employee.organizationId?._id;
        } else {
            employee = await Employee.findById(req.body.employeeId).populate('organizationId');
            employeeId = employee?._id;
            req.orgId = employee?.organizationId?._id;
        }

        if (!req.orgId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });

        // 2. Validate using Service (Policy & Balance check)
        const { totalDays, policy, balance } = await leaveService.validateLeaveRequest(
            employeeId, req.orgId, { leaveType, fromDate, toDate }, employee
        );

        // 3. Create Request
        const leave = await Leave.create({
            employee: employeeId,
            organizationId: req.orgId,
            leaveType,
            startDate: new Date(fromDate),
            endDate: new Date(toDate),
            totalDays,
            halfDay: halfDay || false,
            reason,
            documentUrl,
            status: 'Pending'
        });

        // 4. Update Balance (pending_approval)
        balance.pendingApproval += totalDays;
        await balance.save();

        res.status(201).json({ success: true, data: leave });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all leaves (filtered)
 */
exports.getLeaves = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employee, status, leaveType } = req.query;
        const query = { organizationId: req.orgId || req.user.organizationId };

        if (req.user.role === 'Employee') {
            const emp = await Employee.findOne({ email: req.user.email });
            query.employee = emp._id;
        } else if (employee) {
            query.employee = employee;
        }

        if (status) query.status = status;
        if (leaveType) query.leaveType = leaveType;

        const leaves = await Leave.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Leave.countDocuments(query);

        res.status(200).json({
            success: true,
            data: leaves,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Approve/Reject leave
 */
exports.updateLeaveStatus = async (req, res, next) => {
    try {
        const { status, remarks } = req.body;
        const leave = await Leave.findById(req.params.id).populate('organizationId');
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found.' });

        const year = new Date(leave.startDate).getFullYear();
        const balance = await leaveService.getLeaveBalance(leave.employee, leave.organizationId, leave.leaveType, year);

        if (status === 'Approved' && leave.status !== 'Approved') {
            balance.pendingApproval -= leave.totalDays;
            balance.used += leave.totalDays;
        } else if (status === 'Rejected' && leave.status === 'Pending') {
            balance.pendingApproval -= leave.totalDays;
        }
        
        await balance.save();
        
        leave.status = status;
        leave.remarks = remarks;
        leave.approvedBy = req.user.id;
        await leave.save();

        res.status(200).json({ success: true, data: leave });
    } catch (error) { next(error); }
};

/**
 * @desc    Get dynamic leave balance
 */
exports.getLeaveBalance = async (req, res, next) => {
    try {
        const employeeId = req.params.employeeId;
        const employee = await Employee.findById(employeeId);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const balances = await LeaveBalance.find({ employeeId, year });
        res.status(200).json({ success: true, data: balances });
    } catch (error) { next(error); }
};
