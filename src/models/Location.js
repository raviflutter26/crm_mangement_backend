const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    branch: { type: String, trim: true },
    floor: { type: String, trim: true },
    building: { type: String, trim: true },
    capacity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);
