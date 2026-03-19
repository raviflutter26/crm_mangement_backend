const SalaryComponent = require('../models/SalaryComponent');

// Default seed data matching Zoho Payroll
const DEFAULT_COMPONENTS = [
    // ── EARNINGS ──
    { name: 'Basic', category: 'earning', componentType: 'Basic', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 50% of CTC', calculationBase: 'CTC', calculationValue: 50, considerForEPF: true, considerForESI: true, isActive: true, isSystem: true, sortOrder: 1 },
    { name: 'Dearness Allowance', category: 'earning', componentType: 'Dearness Allowance', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 20% of Basic', calculationBase: 'Basic', calculationValue: 20, considerForEPF: true, considerForESI: true, isActive: false, isSystem: true, sortOrder: 2 },
    { name: 'House Rent Allowance', category: 'earning', componentType: 'House Rent Allowance', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 40% of Basic', calculationBase: 'Basic', calculationValue: 40, considerForEPF: false, considerForESI: true, isActive: true, isSystem: true, sortOrder: 3 },
    { name: 'Conveyance Allowance OLD', category: 'earning', componentType: 'Conveyance Allowance', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 10% of Basic', calculationBase: 'Basic', calculationValue: 10, considerForEPF: false, considerForESI: true, isActive: true, isSystem: true, sortOrder: 4 },
    { name: 'Conveyance Allowance', category: 'earning', componentType: 'Conveyance Allowance', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 10% of Basic', calculationBase: 'Basic', calculationValue: 10, considerForEPF: true, epfCondition: 'If PF Wage < 15k', considerForESI: true, isActive: true, isSystem: true, sortOrder: 5 },
    { name: 'Children Education Allowance', category: 'earning', componentType: 'Children Education Allowance', calculationType: 'fixed_flat', calculationDescription: 'Fixed; Flat Amount', considerForEPF: false, considerForESI: true, isActive: false, isSystem: true, sortOrder: 6 },
    { name: 'Transport Allowance', category: 'earning', componentType: 'Transport Allowance', calculationType: 'fixed_flat', calculationDescription: 'Fixed; Flat amount of 1600', calculationValue: 1600, considerForEPF: false, considerForESI: true, isActive: false, isSystem: true, sortOrder: 7 },
    { name: 'Travelling Allowance', category: 'earning', componentType: 'Travelling Allowance', calculationType: 'fixed_percentage', calculationDescription: 'Fixed; 20% of Basic', calculationBase: 'Basic', calculationValue: 20, considerForEPF: false, considerForESI: false, isActive: false, isSystem: true, sortOrder: 8 },
    { name: 'Special Allowance', category: 'earning', componentType: 'Custom Allowance', calculationType: 'fixed_flat', calculationDescription: 'Fixed; Flat Amount', considerForEPF: true, epfCondition: 'If PF Wage < 15k', considerForESI: true, isActive: true, isSystem: true, sortOrder: 9 },
    { name: 'Special Allowance OLD', category: 'earning', componentType: 'Fixed Allowance', calculationType: 'fixed_flat', calculationDescription: 'Fixed; Flat Amount', considerForEPF: false, considerForESI: true, isActive: true, isSystem: true, sortOrder: 10 },
    { name: 'Overtime Allowance', category: 'earning', componentType: 'Overtime Allowance', calculationType: 'variable_flat', calculationDescription: 'Variable; Flat Amount', considerForEPF: false, considerForESI: false, isActive: true, isSystem: true, sortOrder: 11 },
    { name: 'Leave Bonus', category: 'earning', componentType: 'Custom Allowance', calculationType: 'variable_flat', calculationDescription: 'Variable; Flat Amount', considerForEPF: false, considerForESI: false, isActive: true, isSystem: true, sortOrder: 12 },
    { name: 'Reimbursement of Expenses', category: 'earning', componentType: 'Custom Allowance (Non Taxable)', calculationType: 'variable_flat', calculationDescription: 'Variable; Flat Amount', isTaxable: false, considerForEPF: false, considerForESI: false, isActive: true, isSystem: true, sortOrder: 13 },
    { name: 'Incentive', category: 'earning', componentType: 'Custom Allowance', calculationType: 'variable_flat', calculationDescription: 'Variable; Flat Amount', considerForEPF: false, considerForESI: false, isActive: true, isSystem: true, sortOrder: 14 },
    { name: 'Salary Arrears', category: 'earning', componentType: 'Custom Allowance', calculationType: 'variable_flat', calculationDescription: 'Variable; Flat Amount', considerForEPF: false, considerForESI: true, isActive: true, isSystem: true, sortOrder: 15 },

    // ── DEDUCTIONS ──
    { name: 'Notice Pay Deduction', category: 'deduction', componentType: 'Notice Pay Deduction', frequency: 'one_time', isActive: true, isSystem: true, sortOrder: 1 },

    // ── BENEFITS ──
    { name: 'Voluntary Provident Fund', category: 'benefit', componentType: 'Voluntary Provident Fund', frequency: 'recurring', isActive: true, isSystem: true, sortOrder: 1 },

    // ── REIMBURSEMENTS ──
    { name: 'Fuel Reimbursement', category: 'reimbursement', componentType: 'Fuel Reimbursement', maxReimbursableAmount: 5000, isActive: true, isSystem: true, sortOrder: 1 },
    { name: 'Driver Reimbursement', category: 'reimbursement', componentType: 'Driver Reimbursement', maxReimbursableAmount: 0, isActive: false, isSystem: true, sortOrder: 2 },
    { name: 'Vehicle Maintenance Reimbursement', category: 'reimbursement', componentType: 'Vehicle Maintenance Reimbursement', maxReimbursableAmount: 0, isActive: false, isSystem: true, sortOrder: 3 },
    { name: 'Telephone Reimbursement', category: 'reimbursement', componentType: 'Telephone Reimbursement', maxReimbursableAmount: 0, isActive: false, isSystem: true, sortOrder: 4 },
    { name: 'Leave Travel Allowance', category: 'reimbursement', componentType: 'Leave Travel Reimbursement', maxReimbursableAmount: 0, isActive: false, isSystem: true, sortOrder: 5 },
    { name: 'Reimbursement of Expense', category: 'reimbursement', componentType: 'Business Development Expense Reimbursement', maxReimbursableAmount: 20000, isActive: true, isSystem: true, sortOrder: 6 },
];

// GET all components (optionally filter by category)
exports.getAll = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        const data = await SalaryComponent.find(filter).sort({ sortOrder: 1, createdAt: 1 });
        res.json({ success: true, data });
    } catch (error) { next(error); }
};

// GET single component
exports.getById = async (req, res, next) => {
    try {
        const doc = await SalaryComponent.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Component not found' });
        res.json({ success: true, data: doc });
    } catch (error) { next(error); }
};

// CREATE component
exports.create = async (req, res, next) => {
    try {
        const doc = await SalaryComponent.create(req.body);
        res.status(201).json({ success: true, data: doc, message: 'Component created.' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'A component with this name already exists in this category.' });
        }
        next(error);
    }
};

// UPDATE component
exports.update = async (req, res, next) => {
    try {
        const doc = await SalaryComponent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Component not found' });
        res.json({ success: true, data: doc, message: 'Component updated.' });
    } catch (error) { next(error); }
};

// DELETE component (soft-delete for system, hard-delete for custom)
exports.remove = async (req, res, next) => {
    try {
        const doc = await SalaryComponent.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Component not found' });
        if (doc.isSystem) {
            return res.status(400).json({ success: false, message: 'System components cannot be deleted. You can disable them instead.' });
        }
        await SalaryComponent.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Component deleted.' });
    } catch (error) { next(error); }
};

// TOGGLE status (active/inactive)
exports.toggleStatus = async (req, res, next) => {
    try {
        const doc = await SalaryComponent.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Component not found' });
        doc.isActive = !doc.isActive;
        await doc.save();
        res.json({ success: true, data: doc, message: `Component ${doc.isActive ? 'enabled' : 'disabled'}.` });
    } catch (error) { next(error); }
};

// SEED default components (idempotent — only inserts missing ones)
exports.seedDefaults = async (req, res, next) => {
    try {
        let created = 0;
        for (const comp of DEFAULT_COMPONENTS) {
            const exists = await SalaryComponent.findOne({ name: comp.name, category: comp.category });
            if (!exists) {
                await SalaryComponent.create(comp);
                created++;
            }
        }
        const total = await SalaryComponent.countDocuments();
        res.json({ success: true, message: `Seeded ${created} new components. Total: ${total}.`, data: { created, total } });
    } catch (error) { next(error); }
};
