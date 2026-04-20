const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    branch: { type: String, trim: true },
    floor: { type: String, trim: true },
    building: { type: String, trim: true },
    address: { type: String, trim: true }, // Added missing field
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: 'India' },
    capacity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);
