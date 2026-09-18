const mongoose = require('mongoose');
const branchScope = require('./plugins/branchScope');

const leaveSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        leaveType: {
            type: String,
            enum: ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Compensatory Off', 'Other'],
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        totalDays: {
            type: Number,
            required: true,
        },
        halfDay: {
            type: Boolean,
            default: false,
        },
        reason: {
            type: String,
            required: true,
        },
        documentUrl: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
            default: 'Pending',
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        remarks: {
            type: String,
            default: null,
        },
        isBackdated: {
            type: Boolean,
            default: false,
        },
        excludedDays: {
            type: Number,
            default: 0,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
        },
        leaveBalance: {
            type: Number,
            default: 0,
        },
        leaveCarryForward: {
            type: Number,
            default: 0,
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

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ organizationId: 1, branchId: 1, status: 1 });

// Adds branchId and fills it from the employee's posting branch, so a
// branch-scoped HR sees only their own branch's rows.
leaveSchema.plugin(branchScope);

module.exports = mongoose.model('Leave', leaveSchema);
