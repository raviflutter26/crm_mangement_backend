const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const ppeRecordSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    item: { type: String, required: true },
    issueDate: { type: Date, default: Date.now },
    condition: { type: String, enum: ['New', 'Good', 'Wear Detected', 'Damaged', 'Replaced'], default: 'New' },
    status: { type: String, enum: ['Issued', 'Returned', 'Lost', 'Replaced'], default: 'Issued' },
    nextInspection: { type: Date },
    serialNumber: { type: String },
    notes: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
ppeRecordSchema.plugin(branchScope);

module.exports = mongoose.model('PPERecord', ppeRecordSchema);
