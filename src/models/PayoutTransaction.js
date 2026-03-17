const mongoose = require('mongoose');

const payoutTransactionSchema = new mongoose.Schema({
    payrollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payroll',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
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
payoutTransactionSchema.index({ razorpayPayoutId: 1 });
payoutTransactionSchema.index({ payrollId: 1, employeeId: 1 });

module.exports = mongoose.model('PayoutTransaction', payoutTransactionSchema);
