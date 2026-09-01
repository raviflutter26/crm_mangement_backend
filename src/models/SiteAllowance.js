const mongoose = require('mongoose');

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

siteAllowanceSchema.pre('save', function(next) {
    this.totalAmount = this.days * this.rate;
    next();
});

module.exports = mongoose.model('SiteAllowance', siteAllowanceSchema);
