const mongoose = require('mongoose');

const payrollRunSchema = new mongoose.Schema(
    {
        runId: { type: String, unique: true },
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        status: {
            type: String,
            enum: ['draft', 'processing', 'review', 'approved', 'paid', 'failed'],
            default: 'draft',
        },
        // Summary
        totalEmployees: { type: Number, default: 0 },
        totalGrossPay: { type: Number, default: 0 },
        totalDeductions: { type: Number, default: 0 },
        totalNetPay: { type: Number, default: 0 },
        totalPF: { type: Number, default: 0 },
        totalESI: { type: Number, default: 0 },
        totalPT: { type: Number, default: 0 },
        totalLWF: { type: Number, default: 0 },
        totalTDS: { type: Number, default: 0 },
        totalBonus: { type: Number, default: 0 },
        totalEmployerPF: { type: Number, default: 0 },
        totalEmployerESI: { type: Number, default: 0 },
        // Linked payroll records
        payrollRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }],
        // Metadata
        initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        paidAt: { type: Date },
        paymentMode: {
            type: String,
            enum: ['bank_transfer', 'neft', 'rtgs', 'upi', 'cheque'],
            default: 'bank_transfer',
        },
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

// Auto-generate runId
payrollRunSchema.pre('save', async function () {
    if (!this.runId) {
        const count = await mongoose.model('PayrollRun').countDocuments();
        this.runId = `PR-${this.year}-${String(this.month).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;
    }
});

payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
