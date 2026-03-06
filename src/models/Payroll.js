const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        earnings: {
            basic: { type: Number, default: 0 },
            hra: { type: Number, default: 0 },
            da: { type: Number, default: 0 },
            ta: { type: Number, default: 0 },
            specialAllowance: { type: Number, default: 0 },
            bonus: { type: Number, default: 0 },
            overtime: { type: Number, default: 0 },
            otherEarnings: { type: Number, default: 0 },
        },
        deductions: {
            pf: { type: Number, default: 0 },
            esi: { type: Number, default: 0 },
            tax: { type: Number, default: 0 },
            professionalTax: { type: Number, default: 0 },
            loanDeduction: { type: Number, default: 0 },
            otherDeductions: { type: Number, default: 0 },
        },
        totalEarnings: {
            type: Number,
            default: 0,
        },
        totalDeductions: {
            type: Number,
            default: 0,
        },
        netPay: {
            type: Number,
            default: 0,
        },
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Processing', 'Paid', 'Failed'],
            default: 'Pending',
        },
        paymentDate: {
            type: Date,
            default: null,
        },
        paymentMethod: {
            type: String,
            enum: ['Bank Transfer', 'Cheque', 'Cash', null],
            default: null,
        },
        transactionId: {
            type: String,
            default: null,
        },
        workingDays: {
            type: Number,
            default: 0,
        },
        presentDays: {
            type: Number,
            default: 0,
        },
        leaveDays: {
            type: Number,
            default: 0,
        },
        zohoPayrunId: {
            type: String,
            default: null,
        },
        payslipUrl: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

// Calculate totals before saving
payrollSchema.pre('save', function () {
    const earnings = this.earnings;
    this.totalEarnings =
        earnings.basic +
        earnings.hra +
        earnings.da +
        earnings.ta +
        earnings.specialAllowance +
        earnings.bonus +
        earnings.overtime +
        earnings.otherEarnings;

    const deductions = this.deductions;
    this.totalDeductions =
        deductions.pf +
        deductions.esi +
        deductions.tax +
        deductions.professionalTax +
        deductions.loanDeduction +
        deductions.otherDeductions;

    this.netPay = this.totalEarnings - this.totalDeductions;
});

module.exports = mongoose.model('Payroll', payrollSchema);
