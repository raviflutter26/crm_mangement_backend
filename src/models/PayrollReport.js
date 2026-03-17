const mongoose = require('mongoose');

const payrollReportSchema = new mongoose.Schema({
    reportName: {
        type: String,
        required: true,
        trim: true
    },
    reportType: {
        type: String,
        required: true,
        enum: ['excel', 'pdf', 'csv', 'print']
    },
    reportCategory: {
        type: String,
        required: true,
        enum: [
            'Payroll Overview',
            'Statutory Reports',
            'Employee Reports',
            'Deduction Reports',
            'Tax Reports',
            'Investment Declarations',
            'Loan Reports',
            'Payroll Journal',
            'Activity Logs'
        ]
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    generatedDate: {
        type: Date,
        default: Date.now
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    department: {
        type: String,
        default: 'All'
    },
    fileUrl: {
        type: String
    },
    status: {
        type: String,
        enum: ['Generated', 'Pending', 'Failed'],
        default: 'Generated'
    }
}, {
    timestamps: true,
    collection: 'payroll_reports'
});

module.exports = mongoose.model('PayrollReport', payrollReportSchema);
