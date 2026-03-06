const mongoose = require('mongoose');

const salaryStructureSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String, default: '' },
        // Earnings breakdown as % of CTC
        earnings: {
            basicPercent: { type: Number, default: 40 },
            hraPercent: { type: Number, default: 20 },
            daPercent: { type: Number, default: 0 },
            taPercent: { type: Number, default: 0 },
            specialAllowancePercent: { type: Number, default: 40 },
            customComponents: [
                {
                    name: { type: String },
                    type: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
                    value: { type: Number, default: 0 },
                    taxable: { type: Boolean, default: true },
                },
            ],
        },
        // Deduction settings
        deductions: {
            pfEnabled: { type: Boolean, default: true },
            esiEnabled: { type: Boolean, default: true },
            ptEnabled: { type: Boolean, default: true },
            tdsEnabled: { type: Boolean, default: true },
        },
        // Applicability
        applicableFrom: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
