const mongoose = require('mongoose');

const ipAllowlistEntrySchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true },
    ipOrCidr: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('IpAllowlistEntry', ipAllowlistEntrySchema);
