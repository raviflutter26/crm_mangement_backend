const mongoose = require('mongoose');

const attendanceConfigSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
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
    minHoursForPresent: {
        type: Number,
        default: 9.5,
    },
    halfDayHours: {
        type: Number,
        default: 4.75,
    },
    absentThreshold: {
        type: Number,
        default: 120, // minutes after startTime + grace
    },
    lateAfterGraceAction: {
        type: String,
        enum: ['Late', 'Absent', 'HalfDay'],
        default: 'Late'
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata',
    },
    effectiveFrom: {
        type: Date,
        default: Date.now,
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
    // Permission Policy (Shared legacy config, will be overridden by PermissionConfig if exists)
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
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

attendanceConfigSchema.index({ organizationId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);
