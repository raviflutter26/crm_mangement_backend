const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    leaveType: {
        type: String,
        enum: ['annual', 'sick', 'personal', 'custom', 'Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Compensatory Off', 'Other'],
        required: true,
    },
    leaveTypeLabel: {
        type: String,
        required: true,
        trim: true,
    },
    daysPerYear: {
        type: Number,
        default: 0,
    },
    accrualType: {
        type: String,
        enum: ['upfront', 'monthly', 'quarterly'],
        default: 'upfront',
    },
    accrualAmount: {
        type: Number,
        default: 0,
    },
    carryForwardDays: {
        type: Number,
        default: 0,
    },
    encashable: {
        type: Boolean,
        default: false,
    },
    requiresDocument: {
        type: Boolean,
        default: false,
    },
    minDaysNotice: {
        type: Number,
        default: 0,
    },
    maxConsecutiveDays: {
        type: Number,
        default: 365,
    },
    applicableAfterDays: {
        type: Number,
        default: 0, // probation period
    },
    genderSpecific: {
        type: String,
        enum: ['male', 'female', 'other', null],
        default: null,
    },
    effectiveYear: {
        type: Number,
        default: new Date().getFullYear(),
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

leavePolicySchema.index({ organizationId: 1, leaveType: 1, effectiveYear: -1 });

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
