const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    leaveType: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    totalEntitled: {
        type: Number,
        default: 0,
    },
    used: {
        type: Number,
        default: 0,
    },
    pendingApproval: {
        type: Number,
        default: 0,
    },
    carriedForward: {
        type: Number,
        default: 0,
    },
    lapsed: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

leaveBalanceSchema.virtual('remaining').get(function() {
    return this.totalEntitled - this.used - this.pendingApproval;
});

leaveBalanceSchema.index({ employeeId: 1, leaveType: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
