const PayrollRun = require('../models/PayrollRun');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const ComplianceSettings = require('../models/ComplianceSettings');
const { calculateSalaryBreakdown } = require('../utils/taxCalculator');

// Get all payroll runs
exports.getPayrollRuns = async (req, res, next) => {
    try {
        const runs = await PayrollRun.find({})
            .populate('initiatedBy', 'name email')
            .populate('approvedBy', 'name email')
            .sort('-year -month');
        res.status(200).json({ success: true, data: runs });
    } catch (error) { next(error); }
};

// Get single payroll run with details
exports.getPayrollRunById = async (req, res, next) => {
    try {
        const run = await PayrollRun.findById(req.params.id)
            .populate('payrollRecords')
            .populate('initiatedBy', 'name email')
            .populate('approvedBy', 'name email');
        if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' });

        // Populate employee details in payroll records
        const records = await Payroll.find({ _id: { $in: run.payrollRecords } })
            .populate('employee', 'firstName lastName employeeId department designation bankDetails');

        res.status(200).json({ success: true, data: { ...run.toObject(), payrollRecords: records } });
    } catch (error) { next(error); }
};

// Initiate payroll run — This is the main automation endpoint
exports.initiatePayrollRun = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required.' });

        // Check for existing run
        const existing = await PayrollRun.findOne({ month: parseInt(month), year: parseInt(year) });
        if (existing) return res.status(400).json({ success: false, message: `Payroll run already exists for ${month}/${year}. RunID: ${existing.runId}` });

        // Get compliance settings
        let compliance = await ComplianceSettings.findOne({ isActive: true });
        if (!compliance) {
            compliance = { pf: { enabled: true, employeeContribution: 12, employerContribution: 12, wageLimit: 15000 }, esi: { enabled: true, employeeContribution: 0.75, employerContribution: 3.25, wageLimit: 21000 }, professionalTax: { enabled: true }, tds: { enabled: true } };
        }

        // Get all active employees
        const employees = await Employee.find({ status: 'Active' });
        if (employees.length === 0) return res.status(400).json({ success: false, message: 'No active employees found.' });

        // Calculate working days in the month
        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day !== 0) workingDays++; // Exclude Sundays
        }

        // Create payroll run
        const payrollRun = new PayrollRun({
            month: parseInt(month),
            year: parseInt(year),
            status: 'processing',
            totalEmployees: employees.length,
            initiatedBy: req.user?._id,
        });

        const payrollRecords = [];
        let totalGross = 0, totalDed = 0, totalNet = 0;
        let totalPF = 0, totalESI = 0, totalPT = 0, totalTDS = 0;
        let totalErPF = 0, totalErESI = 0;

        for (const emp of employees) {
            // Get attendance for this employee in this month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            const attendanceCount = await Attendance.countDocuments({
                employee: emp._id,
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['Present', 'Half Day', 'WFH'] },
            });
            const halfDays = await Attendance.countDocuments({
                employee: emp._id,
                date: { $gte: startDate, $lte: endDate },
                status: 'Half Day',
            });
            const presentDays = attendanceCount - (halfDays * 0.5);
            const leaveDays = workingDays - presentDays;

            // Calculate salary breakdown using tax calculator
            const breakdown = calculateSalaryBreakdown(emp, compliance, workingDays, presentDays);

            // Create individual payroll record
            const payrollRecord = await Payroll.create({
                employee: emp._id,
                month: parseInt(month),
                year: parseInt(year),
                earnings: {
                    basic: breakdown.earnings.basic,
                    hra: breakdown.earnings.hra,
                    da: breakdown.earnings.da,
                    ta: breakdown.earnings.ta,
                    specialAllowance: breakdown.earnings.specialAllowance,
                },
                deductions: {
                    pf: breakdown.deductions.pf,
                    esi: breakdown.deductions.esi,
                    tax: breakdown.deductions.tds,
                    professionalTax: breakdown.deductions.professionalTax,
                },
                totalEarnings: breakdown.grossEarnings,
                totalDeductions: breakdown.totalDeductions,
                netPay: breakdown.netPay,
                workingDays,
                presentDays,
                leaveDays,
                paymentStatus: 'Pending',
            });

            payrollRecords.push(payrollRecord._id);
            totalGross += breakdown.grossEarnings;
            totalDed += breakdown.totalDeductions;
            totalNet += breakdown.netPay;
            totalPF += breakdown.deductions.pf;
            totalESI += breakdown.deductions.esi;
            totalPT += breakdown.deductions.professionalTax;
            totalTDS += breakdown.deductions.tds;
            totalErPF += breakdown.employerContributions.pf;
            totalErESI += breakdown.employerContributions.esi;
        }

        // Update payroll run with totals
        payrollRun.payrollRecords = payrollRecords;
        payrollRun.totalGrossPay = totalGross;
        payrollRun.totalDeductions = totalDed;
        payrollRun.totalNetPay = totalNet;
        payrollRun.totalPF = totalPF;
        payrollRun.totalESI = totalESI;
        payrollRun.totalPT = totalPT;
        payrollRun.totalTDS = totalTDS;
        payrollRun.totalEmployerPF = totalErPF;
        payrollRun.totalEmployerESI = totalErESI;
        payrollRun.status = 'review';
        await payrollRun.save();

        res.status(201).json({ success: true, data: payrollRun, message: `Payroll processed for ${employees.length} employees.` });
    } catch (error) { next(error); }
};

// Approve payroll run
exports.approvePayrollRun = async (req, res, next) => {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' });
        if (run.status !== 'review') return res.status(400).json({ success: false, message: `Cannot approve a run with status '${run.status}'.` });

        run.status = 'approved';
        run.approvedBy = req.user?._id;
        run.approvedAt = new Date();
        await run.save();

        res.status(200).json({ success: true, data: run, message: 'Payroll run approved.' });
    } catch (error) { next(error); }
};

// Mark payroll as paid
exports.markAsPaid = async (req, res, next) => {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' });
        if (run.status !== 'approved') return res.status(400).json({ success: false, message: 'Run must be approved first.' });

        run.status = 'paid';
        run.paidAt = new Date();
        run.paymentMode = req.body.paymentMode || 'bank_transfer';
        await run.save();

        // Update individual records
        await Payroll.updateMany(
            { _id: { $in: run.payrollRecords } },
            { paymentStatus: 'Paid', paymentDate: new Date(), paymentMethod: 'Bank Transfer' }
        );

        res.status(200).json({ success: true, data: run, message: 'Payroll marked as paid.' });
    } catch (error) { next(error); }
};

// Delete payroll run
exports.deletePayrollRun = async (req, res, next) => {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found.' });
        if (run.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot delete a paid payroll run.' });

        // Delete individual payroll records
        await Payroll.deleteMany({ _id: { $in: run.payrollRecords } });
        await PayrollRun.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Payroll run deleted.' });
    } catch (error) { next(error); }
};
