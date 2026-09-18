const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const certificationSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    issuer: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    credentialId: { type: String },
    status: { type: String, enum: ['Active', 'Expired', 'Revoked', 'Pending'], default: 'Active' },
    documentUrl: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
certificationSchema.plugin(branchScope);

module.exports = mongoose.model('Certification', certificationSchema);
