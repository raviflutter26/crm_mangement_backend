const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const siteAllowanceSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['Site Daily Allowance', 'Night Shift Allowance', 'Hazard Pay', 'Remote Area Allowance', 'Other'], default: 'Site Daily Allowance' },
    site: { type: String, required: true },
    days: { type: Number, default: 1 },
    rate: { type: Number, required: true },
    totalAmount: { type: Number },
    period: { month: Number, year: Number },
    status: { type: String, enum: ['Pending', 'Processed', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

// Mongoose 9 removed the `next` callback style for middleware: the hook is
// called with no arguments and whatever it returns is awaited.
siteAllowanceSchema.pre('save', function () {
    this.totalAmount = this.days * this.rate;
});


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
siteAllowanceSchema.plugin(branchScope);

module.exports = mongoose.model('SiteAllowance', siteAllowanceSchema);
