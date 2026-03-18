const mongoose = require('mongoose');

const attendanceConfigSchema = new mongoose.Schema({
    // Office Timing
    startTime: {
        type: String,
        default: '09:00', // HH:mm
    },
    endTime: {
        type: String,
        default: '18:00',
    },
    workingHours: {
        type: Number,
        default: 9,
    },
    graceMinutes: {
        type: Number,
        default: 30,
    },

    // Late Policy
    latePolicyEnabled: {
        type: Boolean,
        default: true
    },
    maxLateDaysPerMonth: {
        type: Number,
        default: 3,
    },
    lateMarkType: {
        type: String,
        enum: ['half_day', 'warning'],
        default: 'half_day'
    },

    // Permission Policy
    permissionEnabled: {
        type: Boolean,
        default: true
    },
    maxPermissionCount: {
        type: Number,
        default: 4,
    },
    maxPermissionHours: {
        type: Number,
        default: 4,
    },

    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);
