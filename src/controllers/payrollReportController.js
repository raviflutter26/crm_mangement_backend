const PayrollReport = require('../models/PayrollReport');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

// Helper to generate CSV
const generateCSV = (data, columns) => {
    const header = columns.join(',');
    const rows = data.map(item => {
        return columns.map(col => {
            const val = item[col] !== undefined ? item[col] : '';
            // Handle commas in values
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',');
    });
    return [header, ...rows].join('\n');
};

// Get all reports
exports.getReports = async (req, res) => {
    try {
        const { category, month, year, department } = req.query;
        let query = {};

        if (category) query.reportCategory = category;
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);
        if (department && department !== 'All') query.department = department;

        const reports = await PayrollReport.find(query)
            .populate('generatedBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: err.message
        });
    }
};

// Get single report
exports.getReportById = async (req, res) => {
    try {
        const report = await PayrollReport.findById(req.params.id).populate('generatedBy', 'name email');
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }
        res.status(200).json({
            success: true,
            data: report
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// Generate report (Real for common types)
exports.generateReport = async (req, res) => {
    try {
        const { reportName, reportCategory, month, year, department, reportType = 'csv' } = req.body;

        let csvData = [];
        let columns = [];

        if (reportName === 'Payroll Summary' || reportName === 'Salary Register - Monthly') {
            const payrolls = await Payroll.find({ month, year }).populate('employee', 'firstName lastName employeeId');
            columns = ['EmployeeID', 'Name', 'Gross', 'Deductions', 'NetPay', 'Status'];
            csvData = payrolls.map(p => ({
                EmployeeID: p.employee?.employeeId,
                Name: `${p.employee?.firstName} ${p.employee?.lastName}`,
                Gross: p.totalEarnings,
                Deductions: p.totalDeductions,
                NetPay: p.netPay,
                Status: p.paymentStatus
            }));
        } else if (reportName === 'Compensation Details') {
            const emps = await Employee.find(department && department !== 'All' ? { department } : {});
            columns = ['EmployeeID', 'Name', 'Department', 'Designation', 'CTC', 'Basic', 'HRA'];
            csvData = emps.map(e => ({
                EmployeeID: e.employeeId,
                Name: `${e.firstName} ${e.lastName}`,
                Department: e.department,
                Designation: e.designation,
                CTC: e.ctc,
                Basic: e.salary?.basic,
                HRA: e.salary?.hra
            }));
        } else {
            // Mock data for other reports
            columns = ['Date', 'Category', 'Description', 'Amount'];
            csvData = [{ Date: new Date().toLocaleDateString(), Category: reportCategory, Description: `Mock data for ${reportName}`, Amount: 0 }];
        }

        const csvContent = generateCSV(csvData, columns);
        
        const report = new PayrollReport({
            reportName,
            reportCategory,
            reportType,
            month,
            year,
            department,
            generatedBy: req.user.id,
            status: 'Generated',
            fileUrl: `data:text/csv;base64,${Buffer.from(csvContent).toString('base64')}`
        });

        await report.save();

        res.status(201).json({
            success: true,
            data: report
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: err.message
        });
    }
};

// Download report
exports.downloadReport = async (req, res) => {
    try {
        const report = await PayrollReport.findById(req.params.id);
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        if (report.fileUrl && report.fileUrl.startsWith('data:text/csv;base64,')) {
            const base64Content = report.fileUrl.replace('data:text/csv;base64,', '');
            const csvBuffer = Buffer.from(base64Content, 'base64');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${report.reportName.replace(/\s+/g, '_')}_${report.month}_${report.year}.csv"`);
            return res.send(csvBuffer);
        }

        res.status(400).json({ success: false, message: 'Report file not available' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Export (Mock)
exports.exportReport = async (req, res) => {
    try {
        const { type } = req.query; // excel, pdf, csv
        res.status(200).json({
            success: true,
            message: `Report export to ${type} initiated`,
            downloadUrl: `https://example.com/export/payroll-report-${Date.now()}.${type}`
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};
