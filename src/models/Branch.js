const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
    pincode: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    headOfBranch: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

branchSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
