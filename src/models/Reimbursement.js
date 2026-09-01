const mongoose = require('mongoose');

const reimbursementSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: ['Fuel / Transport', 'Meals & Lodging', 'Equipment', 'Communication', 'Medical', 'Other'], default: 'Other' },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    site: { type: String },
    description: { type: String },
    receiptUrl: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Disbursed'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Reimbursement', reimbursementSchema);
