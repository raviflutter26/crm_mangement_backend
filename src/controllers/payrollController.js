const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const AuditLog = require('../models/AuditLog');
const zohoPayrollService = require('../services/zohoPayrollService');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    Get payroll records
 * @route   GET /api/payroll
 */
exports.getPayroll = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employee, month, year, status } = req.query;

        const orgId = req.user?.organizationId;
        const role = (req.user?.role || '').toLowerCase();
        const query = { organizationId: orgId };
        // Employees can only ever see their own payroll records — never trust a client-supplied employee id for this role.
        if (role === 'employee') {
            query.employee = req.user._id;
        } else if (employee) {
            query.employee = employee;
        }
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);
        if (status) query.paymentStatus = status;

        const records = await Payroll.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .sort('-year -month')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Payroll.countDocuments(query);

        res.status(200).json({
            success: true,
            data: records,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single payroll record
 * @route   GET /api/payroll/:id
 */
exports.getPayrollById = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const role = (req.user?.role || '').toLowerCase();
        const record = await Payroll.findOne({ _id: req.params.id, organizationId: orgId })
            .populate('employee', 'firstName lastName employeeId department designation bankDetails');
        if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found for your organization.' });
        if (role === 'employee' && String(record.employee?._id || record.employee) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this payroll record.' });
        }
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create/Run payroll
 * @route   POST /api/payroll
 */
exports.createPayroll = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const record = await Payroll.create({ ...req.body, organizationId: orgId });
        res.status(201).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update payroll status
 * @route   PUT /api/payroll/:id
 */
exports.updatePayroll = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const record = await Payroll.findOneAndUpdate(
            { _id: req.params.id, organizationId: orgId },
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );
        if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found for your organization.' });
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get payroll summary/dashboard
 * @route   GET /api/payroll/summary
 */
exports.getPayrollSummary = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();

        const orgId = req.user?.organizationId;
        const summary = await Payroll.aggregate([
            { $match: { month: parseInt(currentMonth), year: parseInt(currentYear), organizationId: orgId } },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: '$totalEarnings' },
                    totalDeductions: { $sum: '$totalDeductions' },
                    totalNetPay: { $sum: '$netPay' },
                    employeeCount: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Pending'] }, 1, 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] } },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: summary[0] || {
                totalEarnings: 0,
                totalDeductions: 0,
                totalNetPay: 0,
                employeeCount: 0,
                pending: 0,
                paid: 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Sync payroll from Zoho
 * @route   POST /api/payroll/sync
 */
exports.syncFromZoho = async (req, res, next) => {
    try {
        const payRuns = await zohoPayrollService.getPayRuns();
        res.status(200).json({
            success: true,
            message: 'Payroll sync initiated.',
            data: payRuns,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get payslip from Zoho
 * @route   GET /api/payroll/payslip/:employeeId/:payRunId
 */
exports.getPayslip = async (req, res, next) => {
    try {
        const { employeeId, payRunId } = req.params;
        const payslip = await zohoPayrollService.getPayslip(employeeId, payRunId);

        await logAction(req.user?._id, 'view_payslip', 'Payroll', {
            message: `Payslip viewed for employee ${employeeId} (run ${payRunId})`,
            entity: 'Payroll',
            entityId: employeeId,
        }, req);

        res.status(200).json({ success: true, data: payslip });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Attendance-based pro-rata summary per employee for payroll processing
 * @route   GET /api/payroll/attendance-summary?month=&year=
 */
exports.getAttendanceSummary = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const employees = await User.find({ organizationId: orgId, status: 'Active' });

        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day !== 0) workingDays++; // exclude Sundays, matching payroll run generation
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const data = [];
        for (const emp of employees) {
            const records = await Attendance.find({ employee: emp._id, date: { $gte: startDate, $lte: endDate } });
            const presentCount = records.filter(r => ['Present', 'Half Day', 'WFH'].includes(r.status)).length;
            const halfDays = records.filter(r => r.status === 'Half Day').length;
            const presentDays = presentCount - (halfDays * 0.5);
            const overtime = records.reduce((s, r) => s + (r.overtime || 0), 0);

            const approvedLeaves = await Leave.find({
                employee: emp._id,
                status: 'Approved',
                startDate: { $lte: endDate },
                endDate: { $gte: startDate },
            });
            const paidLeaves = approvedLeaves.reduce((s, l) => s + (l.totalDays || 0), 0);
            const lop = Math.max(0, workingDays - presentDays - paidLeaves);

            data.push({
                employeeId: emp._id.toString(),
                employee: emp._id.toString(),
                workingDays,
                presentDays,
                paidLeaves,
                unpaidLeaves: 0,
                lop,
                overtime,
            });
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Payroll-scoped audit trail (run/approve/lock/disburse/retry/payslip/bank actions)
 * @route   GET /api/payroll/audit-logs
 */
exports.getPayrollAuditLogs = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const orgUsers = await User.find({ organizationId: orgId }).select('_id');
        const userIds = orgUsers.map(u => u._id);

        const logs = await AuditLog.find({ module: 'Payroll', userId: { $in: userIds } })
            .populate('userId', 'firstName lastName role')
            .sort('-createdAt')
            .limit(200);

        const data = logs.map(log => ({
            _id: log._id,
            action: log.action,
            actor: log.userId ? `${log.userId.firstName} ${log.userId.lastName}`.trim() : 'System',
            actorRole: log.userId?.role,
            entity: log.details?.entity,
            entityId: log.details?.entityId,
            details: log.details?.message,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt,
            status: log.details?.status || 'success',
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
