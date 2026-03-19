const mongoose = require('mongoose');

const salaryComponentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        category: {
            type: String,
            enum: ['earning', 'deduction', 'benefit', 'reimbursement'],
            required: true
        },
        componentType: { type: String, required: true }, // e.g. "Basic", "House Rent Allowance", "Custom Allowance"
        calculationType: {
            type: String,
            enum: ['fixed_percentage', 'fixed_flat', 'variable_flat', 'variable_percentage'],
            default: 'fixed_flat'
        },
        // e.g. "Fixed; 50% of CTC" or "Fixed; Flat Amount" or "Variable; Flat Amount"
        calculationDescription: { type: String, default: '' },
        calculationBase: { type: String, default: '' }, // e.g. "CTC", "Basic", ""
        calculationValue: { type: Number, default: 0 }, // percentage or flat amount
        
        // Statutory flags (for earnings)
        considerForEPF: { type: Boolean, default: false },
        epfCondition: { type: String, default: '' }, // e.g. "If PF Wage < 15k"
        considerForESI: { type: Boolean, default: false },

        // For deductions/benefits
        frequency: {
            type: String,
            enum: ['monthly', 'one_time', 'recurring', 'yearly', 'half_yearly', 'quarterly'],
            default: 'monthly'
        },

        // For reimbursements  
        maxReimbursableAmount: { type: Number, default: 0 },

        isTaxable: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },
        isSystem: { type: Boolean, default: false }, // System-generated defaults can't be deleted
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate names within same category
salaryComponentSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('SalaryComponent', salaryComponentSchema);
