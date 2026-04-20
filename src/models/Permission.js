const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        permissionType: {
            type: String,
            enum: ['early_leave', 'late_arrival', 'mid_day'],
            required: true,
        },
        requestedDate: {
            type: Date,
            required: true,
        },
        fromTime: {
            type: String, // HH:mm
            required: true,
        },
        toTime: {
            type: String, // HH:mm
            required: true,
        },
        durationMinutes: {
            type: Number,
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending',
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        monthYear: {
            type: String, // YYYY-MM
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Permission', permissionSchema);
