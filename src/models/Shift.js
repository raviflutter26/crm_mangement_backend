const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true }, // HH:mm format
    endTime: { type: String, required: true },   // HH:mm format
    workingHours: { type: Number, default: 8 },
    graceMinutes: { type: Number, default: 15 },
    maxLatePerMonth: { type: Number, default: 3 },
    workingDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    isNightShift: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);
