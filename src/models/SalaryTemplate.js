const mongoose = require('mongoose');

const salaryTemplateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: { type: String },
        basicPercent: { type: Number, required: true, default: 40 },
        hraPercent: { type: Number, required: true, default: 20 },
        daPercent: { type: Number, required: true, default: 10 },
        specialAllowancePercent: { type: Number, required: true, default: 30 },
        isDefault: { type: Boolean, default: false },
        department: { type: String, default: 'All' },
        role: { type: String, default: 'All' },
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

// Compound index for unique name PER organization
salaryTemplateSchema.index({ name: 1, organizationId: 1 }, { unique: true });

// Ensure total is 100%
// Mongoose 9 removed the `next` callback style for middleware: the hook is
// called with no arguments and whatever it returns is awaited.
// Rejecting is now done by throwing, which Kareem surfaces as the save error.
salaryTemplateSchema.pre('save', function () {
    const total = this.basicPercent + this.hraPercent + this.daPercent + this.specialAllowancePercent;
    if (total !== 100) {
        throw new Error('Total percentage must be exactly 100%');
    }
});

module.exports = mongoose.model('SalaryTemplate', salaryTemplateSchema);
