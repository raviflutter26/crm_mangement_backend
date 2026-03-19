const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    organizationId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    workingDays: {
        type: [String],
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    attendanceSettings: {
        defaultStartTime: { type: String, default: '09:00' },
        defaultEndTime: { type: String, default: '18:00' },
        graceMinutes: { type: Number, default: 15 },
        workingHours: { type: Number, default: 8 },
        maxLatePerMonth: { type: Number, default: 3 }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'organizations'
});

module.exports = mongoose.model('Organization', organizationSchema);
