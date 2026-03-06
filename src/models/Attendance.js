const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        sessions: [
            {
                checkIn: { type: Date, required: true },
                checkOut: { type: Date, default: null },
                hours: { type: Number, default: 0 }
            }
        ],
        // Legacy fields mapping for backward compatibility and quick reference
        checkIn: {
            type: Date,
            default: null,
        },
        checkOut: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekend', 'WFH'],
            default: 'Present',
        },
        totalHours: {
            type: Number,
            default: 0,
        },
        overtime: {
            type: Number,
            default: 0,
        },
        // Biometric / Source tracking
        source: {
            type: String,
            enum: ['biometric', 'manual', 'gps', 'web', 'mobile', 'system'],
            default: 'web',
        },
        // GPS location
        location: {
            checkInLat: { type: Number, default: null },
            checkInLng: { type: Number, default: null },
            checkOutLat: { type: Number, default: null },
            checkOutLng: { type: Number, default: null },
        },
        // Device tracking
        deviceId: { type: String, default: null },
        ipAddress: { type: String, default: null },
        // Late / Early tracking
        lateBy: { type: Number, default: 0 }, // minutes late
        earlyLeaveBy: { type: Number, default: 0 }, // minutes early
        isLate: { type: Boolean, default: false },
        // Break tracking
        breakDuration: { type: Number, default: 0 }, // minutes
        effectiveHours: { type: Number, default: 0 }, // totalHours - break
        // Regularization
        regularized: { type: Boolean, default: false },
        regularizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        regularizedReason: { type: String, default: null },
        regularizationStatus: {
            type: String,
            enum: ['none', 'pending', 'approved', 'rejected'],
            default: 'none',
        },
        // Shift reference
        shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
        notes: {
            type: String,
            default: null,
        },
        zohoRecordId: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
