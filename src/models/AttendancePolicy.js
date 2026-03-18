const mongoose = require('mongoose');

const attendancePolicySchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Default Policy'
    },
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
    maxLateDays: {
        type: Number,
        default: 3,
    },
    maxPermissionCount: {
        type: Number,
        default: 4,
    },
    maxPermissionHours: {
        type: Number,
        default: 4,
    },
    lateAfterGraceAction: {
        type: String,
        enum: ['Late', 'Absent', 'HalfDay'],
        default: 'Late'
    },
    lateExceedAction: {
        type: String,
        enum: ['HalfDay', 'Absent'],
        default: 'HalfDay'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AttendancePolicy', attendancePolicySchema);
