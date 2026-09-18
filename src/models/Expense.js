const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const expenseSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String, trim: true },
    category: { type: String, enum: ['travel', 'food', 'accommodation', 'equipment', 'training', 'medical', 'other'], default: 'other' },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    date: { type: Date, default: Date.now },
    description: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'reimbursed'], default: 'draft' },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date },
    reimbursedAt: { type: Date },
    rejectionReason: { type: String, trim: true }
}, { timestamps: true });

expenseSchema.index({ organizationId: 1, status: 1 });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
expenseSchema.plugin(branchScope);

module.exports = mongoose.model('Expense', expenseSchema);
