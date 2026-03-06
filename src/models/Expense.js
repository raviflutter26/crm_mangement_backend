const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
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

module.exports = mongoose.model('Expense', expenseSchema);
