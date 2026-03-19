const StatutoryConfig = require('../models/StatutoryConfig');
const Employee = require('../models/Employee');
const { calculateEPF } = require('../utils/statutoryCalc');

/**
 * Get global statutory configuration for the company
 */
exports.getStatutoryConfig = async (req, res) => {
    try {
        // For now, assuming a single global config. In a multi-tenant app, filter by companyId.
        let config = await StatutoryConfig.findOne();
        
        if (!config) {
            // Create default config if none exists
            // Link to a dummy ID if no companyId exists, should be 24-character hex
            const dummyId = "000000000000000000000001"; 
            config = new StatutoryConfig({
                companyId: req.user?.companyId || dummyId, 
                epf: {
                    epfEnabled: true,
                    epfNumber: 'CB/SLM/2972534/000',
                    deductionCycle: 'Monthly',
                    employeeContributionRate: 12,
                    employerContributionMode: 'Restrict to ₹15,000 of PF Wage'
                },
                esi: {
                    esiEnabled: true,
                    esiNumber: '56-00-140218-000-0607',
                    esiDeductionCycle: 'Monthly'
                },
                professionalTax: {
                    ptEnabled: true,
                    ptState: 'Tamil Nadu',
                    ptDeductionCycle: 'Half Yearly'
                },
                labourWelfareFund: {
                    lwfEnabled: true,
                    lwfState: 'Tamil Nadu',
                    lwfDeductionCycle: 'Yearly'
                },
                statutoryBonus: {
                    statutoryBonusEnabled: true,
                    bonusPercentage: 8.33,
                    eligibilityLimit: 21000,
                    paymentFrequency: 'Yearly'
                }
            });
            await config.save();
        }
        
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update specifically EPF settings
 */
exports.updateEPFConfig = async (req, res) => {
    try {
        const config = await StatutoryConfig.findOneAndUpdate(
            {},
            { $set: { epf: req.body } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config.epf });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update ESI settings
 */
exports.updateESIConfig = async (req, res) => {
    try {
        const config = await StatutoryConfig.findOneAndUpdate(
            {},
            { $set: { esi: req.body } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config.esi });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update Professional Tax settings
 */
exports.updatePTConfig = async (req, res) => {
    try {
        const config = await StatutoryConfig.findOneAndUpdate(
            {},
            { $set: { professionalTax: req.body } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config.professionalTax });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update LWF settings
 */
exports.updateLWFConfig = async (req, res) => {
    try {
        const config = await StatutoryConfig.findOneAndUpdate(
            {},
            { $set: { labourWelfareFund: req.body } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config.labourWelfareFund });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update Statutory Bonus settings
 */
exports.updateBonusConfig = async (req, res) => {
    try {
        const config = await StatutoryConfig.findOneAndUpdate(
            {},
            { $set: { statutoryBonus: req.body } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config.statutoryBonus });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get employee-specific statutory details
 */
exports.getEmployeeStatutory = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.employeeId).select('statutory');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        res.status(200).json({ success: true, data: employee.statutory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update employee-specific statutory details
 */
exports.updateEmployeeStatutory = async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(
            req.params.employeeId,
            { $set: { statutory: req.body } },
            { new: true }
        ).select('statutory');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        res.status(200).json({ success: true, data: employee.statutory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * EPF Calculation Preview
 */
exports.previewEPFCalculation = async (req, res) => {
    try {
        const { pfWage } = req.body;
        const config = await StatutoryConfig.findOne();
        if (!config) return res.status(404).json({ success: false, message: 'Statutory config not found' });
        
        const calculation = calculateEPF(pfWage || 0, config.epf);
        res.status(200).json({ success: true, data: calculation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get PT Slabs for a state
 */
exports.getPTSlabs = async (req, res) => {
    try {
        const { state } = req.params;
        // In a real app, this might come from a dedicated lookup table.
        // For now, returning default Tamil Nadu slabs if state is TN.
        if (state === 'Tamil Nadu') {
            return res.status(200).json({
                success: true,
                data: [
                    { minSalary: 0, maxSalary: 21000, taxAmount: 0 },
                    { minSalary: 21001, maxSalary: null, taxAmount: 208.33 }
                ]
            });
        }
        res.status(200).json({ success: true, data: [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
