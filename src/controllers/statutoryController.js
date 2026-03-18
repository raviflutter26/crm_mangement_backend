const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const PayrollRun = require('../models/PayrollRun');

/**
 * @desc    Get PF Report
 * @route   GET /api/statutory/pf-report
 */
exports.getPFReport = async (req, res, next) => {
    try {
        const { month, year, department, employeeId } = req.query;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required.' });
        }

        const query = { month: parseInt(month), year: parseInt(year) };
        
        // Find payroll records
        let payrolls = await Payroll.find(query)
            .populate({
                path: 'employee',
                select: 'firstName lastName employeeId department designations uan pfNumber',
                match: department && department !== 'All' ? { department } : {}
            });

        // Filter out records where employee didn't match department or isn't populated
        payrolls = payrolls.filter(p => p.employee && p.deductions.pf > 0);

        if (employeeId) {
            payrolls = payrolls.filter(p => p.employee._id.toString() === employeeId || p.employee.employeeId === employeeId);
        }

        const reportData = payrolls.map(p => ({
            employeeId: p.employee.employeeId,
            name: `${p.employee.firstName} ${p.employee.lastName}`,
            uan: p.employee.uan || 'N/A',
            pfNumber: p.employee.pfNumber || 'N/A',
            basicSalary: p.earnings.basic,
            employeePF: p.deductions.pf,
            employerPF: p.employerContribution?.pf || Math.round(p.earnings.basic * 0.12), // Fallback logic if not stored
        }));

        res.status(200).json({
            success: true,
            count: reportData.length,
            data: reportData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get ESI Report
 * @route   GET /api/statutory/esi-report
 */
exports.getESIReport = async (req, res, next) => {
    try {
        const { month, year, department, employeeId } = req.query;
        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required.' });
        }

        const query = { month: parseInt(month), year: parseInt(year) };
        
        let payrolls = await Payroll.find(query)
            .populate({
                path: 'employee',
                select: 'firstName lastName employeeId department designation esiNumber',
                match: department && department !== 'All' ? { department } : {}
            });

        payrolls = payrolls.filter(p => p.employee && p.deductions.esi > 0);

        if (employeeId) {
            payrolls = payrolls.filter(p => p.employee._id.toString() === employeeId || p.employee.employeeId === employeeId);
        }

        const reportData = payrolls.map(p => ({
            employeeId: p.employee.employeeId,
            name: `${p.employee.firstName} ${p.employee.lastName}`,
            esiNumber: p.employee.esiNumber || 'N/A',
            grossSalary: p.totalEarnings,
            employeeESI: p.deductions.esi,
            employerESI: p.employerContribution?.esi || Math.round(p.totalEarnings * 0.0325),
        }));

        res.status(200).json({
            success: true,
            count: reportData.length,
            data: reportData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update Employee Statutory Fields
 * @route   POST /api/statutory/employee-update
 */
exports.updateEmployeeStatutory = async (req, res, next) => {
    try {
        const { employeeId, pfEnabled, pfNumber, esiEnabled, esiNumber, uanNumber, esiSalaryLimit } = req.body;
        
        const employee = await Employee.findByIdAndUpdate(
            employeeId,
            { 
                pfEnabled, 
                pfNumber, 
                esiEnabled, 
                esiNumber, 
                uan: uanNumber, // mapping uanNumber to uan field in DB
                esiSalaryLimit 
            },
            { new: true, runValidators: true }
        );

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Statutory fields updated successfully.',
            data: employee
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get Statutory Dashboard Stats
 * @route   GET /api/statutory/dashboard
 */
exports.getStatutoryStats = async (req, res, next) => {
    try {
        const totalPFEmployees = await Employee.countDocuments({ pfEnabled: true });
        const totalESIEmployees = await Employee.countDocuments({ esiEnabled: true });

        // Get totals from last approved payroll run
        const lastRun = await PayrollRun.findOne({ status: 'paid' }).sort({ year: -1, month: -1 });
        
        res.status(200).json({
            success: true,
            data: {
                totalPFEmployees,
                totalESIEmployees,
                totalPFContribution: lastRun ? (lastRun.totalPF + lastRun.totalEmployerPF) : 0,
                totalESIContribution: lastRun ? (lastRun.totalESI + lastRun.totalEmployerESI) : 0,
                lastMonth: lastRun ? `${lastRun.month}/${lastRun.year}` : 'N/A'
            }
        });
    } catch (error) {
        next(error);
    }
};
