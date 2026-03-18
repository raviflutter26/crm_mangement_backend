const mongoose = require('mongoose');

const salaryTemplateSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String },
        basicPercent: { type: Number, required: true, default: 40 },
        hraPercent: { type: Number, required: true, default: 20 },
        daPercent: { type: Number, required: true, default: 10 },
        specialAllowancePercent: { type: Number, required: true, default: 30 },
        isDefault: { type: Boolean, default: false },
        department: { type: String, default: 'All' },
        role: { type: String, default: 'All' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

// Ensure total is 100%
salaryTemplateSchema.pre('save', function(next) {
    const total = this.basicPercent + this.hraPercent + this.daPercent + this.specialAllowancePercent;
    if (total !== 100) {
        return next(new Error('Total percentage must be exactly 100%'));
    }
    next();
});

module.exports = mongoose.model('SalaryTemplate', salaryTemplateSchema);
