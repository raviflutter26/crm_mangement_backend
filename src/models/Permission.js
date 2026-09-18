const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const permissionSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
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


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
permissionSchema.plugin(branchScope);

module.exports = mongoose.model('Permission', permissionSchema);
