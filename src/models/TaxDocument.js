const mongoose = require('mongoose');

const taxDocumentSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    documentType: { type: String, enum: ['Form 16', 'Form 12BB', 'TDS Certificate', 'Investment Declaration', 'Other'], required: true },
    financialYear: { type: String, required: true, trim: true }, // e.g. "2025-26"
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4', null], default: null },
    fileUrl: { type: String },
    fileSize: { type: String },
    status: { type: String, enum: ['Pending', 'Submitted', 'Verified', 'Rejected'], default: 'Submitted' },
    notes: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('TaxDocument', taxDocumentSchema);
