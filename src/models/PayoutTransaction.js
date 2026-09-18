const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const payoutTransactionSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    payrollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payroll',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    razorpayPayoutId: {
        type: String,
        index: true
    },
    fundAccountId: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'queued', 'processed', 'processed_at_bank', 'reversed', 'failed', 'cancelled'],
        default: 'pending'
    },
    mode: {
        type: String,
        enum: ['IMPS', 'NEFT', 'RTGS', 'UPI'],
        default: 'NEFT'
    },
    purpose: {
        type: String,
        default: 'salary'
    },
    errorMessage: {
        type: String
    },
    razorpayResponse: {
        type: Object
    },
    processedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for fast lookup from Webhooks
// payoutTransactionSchema.index({ razorpayPayoutId: 1 }); // Redundant, razorpayPayoutId has index: true above
payoutTransactionSchema.index({ payrollId: 1, employeeId: 1 });
payoutTransactionSchema.index({ organizationId: 1, createdAt: -1 });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
payoutTransactionSchema.plugin(branchScope, { employeePath: 'employeeId' });

module.exports = mongoose.model('PayoutTransaction', payoutTransactionSchema);
