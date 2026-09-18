const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const timesheetSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    totalHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], default: 'Draft' },
    notes: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entries: [{
        date: Date,
        hours: Number,
        task: String,
        site: String
    }],
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
timesheetSchema.plugin(branchScope);

module.exports = mongoose.model('Timesheet', timesheetSchema);
