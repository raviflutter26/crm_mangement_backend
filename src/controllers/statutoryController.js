const StatutoryConfig = require('../models/StatutoryConfig');
const User = require('../models/User');
const { calculateEPF } = require('../utils/statutoryCalc');
const { scopeFilter, requireOrg } = require('../utils/tenancy');

// Statutory defaults applied when an organization has no config yet.
const defaultConfigFor = (organizationId) => ({
    organizationId,
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

/**
 * Fetch this organization's statutory config, creating its defaults on first use.
 */
const loadOrCreateConfig = async (organizationId) => {
    let config = await StatutoryConfig.findOne({ organizationId });
    if (!config) {
        config = new StatutoryConfig(defaultConfigFor(organizationId));
        await config.save();
    }
    return config;
};

/**
 * Update one section of this organization's statutory config.
 * The filter must name the organization: an empty filter would rewrite whichever
 * document happens to be first in the collection, i.e. another tenant's rates.
 */
const updateSection = (section) => async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const config = await StatutoryConfig.findOneAndUpdate(
            { organizationId: orgId },
            { $set: { [section]: req.body }, $setOnInsert: { organizationId: orgId } },
            { new: true, upsert: true }
        );
        res.status(200).json({ success: true, data: config[section] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get this organization's statutory configuration
 */
exports.getStatutoryConfig = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const config = await loadOrCreateConfig(orgId);
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateEPFConfig = updateSection('epf');
exports.updateESIConfig = updateSection('esi');
exports.updatePTConfig = updateSection('professionalTax');
exports.updateLWFConfig = updateSection('labourWelfareFund');
exports.updateBonusConfig = updateSection('statutoryBonus');

/**
 * Get employee-specific statutory details
 */
exports.getEmployeeStatutory = async (req, res) => {
    try {
        // An employee may read only their own statutory details. Tenant scoping
        // below already stopped cross-tenant reads, but within a tenant any
        // colleague could still pull someone else's PF, UAN and ESI numbers.
        const role = (req.user?.role || '').toLowerCase();
        if (role === 'employee' && String(req.params.employeeId) !== String(req.user._id)) {
            return res.status(403).json({ success: false, message: 'You may only view your own statutory details.' });
        }

        // employeeId is client-supplied: constrain it to the caller's organization
        // so PF/UAN/ESI numbers can't be read across tenants.
        const employee = await User.findOne({
            _id: req.params.employeeId,
            ...scopeFilter(req),
        }).select('statutory');
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
        const employee = await User.findOneAndUpdate(
            { _id: req.params.employeeId, ...scopeFilter(req) },
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
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const { pfWage } = req.body;
        const config = await loadOrCreateConfig(orgId);

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
