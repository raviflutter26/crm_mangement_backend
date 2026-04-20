const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contactPerson: { type: String },
    type: { type: String, enum: ['Material Supplier', 'Contractor', 'Service Provider', 'Consultant', 'Other'], default: 'Contractor' },
    status: { type: String, enum: ['Active', 'Inactive', 'Pending Approval', 'Blacklisted'], default: 'Active' },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    bankDetails: { accountNumber: String, ifsc: String, bankName: String },
    notes: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
