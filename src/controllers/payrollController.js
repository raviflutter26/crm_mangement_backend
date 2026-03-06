const Payroll = require('../models/Payroll');
const zohoPayrollService = require('../services/zohoPayrollService');

/**
 * @desc    Get payroll records
 * @route   GET /api/payroll
 */
exports.getPayroll = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, employee, month, year, status } = req.query;

        const query = {};
        if (employee) query.employee = employee;
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
        const record = await Payroll.findById(req.params.id)
            .populate('employee', 'firstName lastName employeeId department designation bankDetails');
        if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found.' });
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
        const record = await Payroll.create(req.body);
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
        const record = await Payroll.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found.' });
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

        const summary = await Payroll.aggregate([
            { $match: { month: parseInt(currentMonth), year: parseInt(currentYear) } },
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
        res.status(200).json({ success: true, data: payslip });
    } catch (error) {
        next(error);
    }
};
