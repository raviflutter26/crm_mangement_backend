const mongoose = require('mongoose');

const permissionConfigSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    monthlyPermissionHours: {
        type: Number,
        default: 3,
    },
    monthlyPermissionMaxTimes: {
        type: Number,
        default: 3,
    },
    minPermissionDurationMins: {
        type: Number,
        default: 30,
    },
    maxPermissionDurationMins: {
        type: Number,
        default: 120,
    },
    permissionTypes: {
        type: [String],
        enum: ['early_leave', 'late_arrival', 'mid_day'],
        default: ['early_leave', 'late_arrival', 'mid_day'],
    },
    requiresManagerApproval: {
        type: Boolean,
        default: true,
    },
    carryForward: {
        type: Boolean,
        default: false,
    },
    effectiveFrom: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    }
}, {
    timestamps: true
});

permissionConfigSchema.index({ organizationId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('PermissionConfig', permissionConfigSchema);
