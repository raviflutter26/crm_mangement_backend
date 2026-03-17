const ComplianceSettings = require('../models/ComplianceSettings');

// Get compliance settings
exports.getSettings = async (req, res, next) => {
    try {
        let settings = await ComplianceSettings.findOne({ isActive: true });
        if (!settings) {
            // Create default settings
            settings = await ComplianceSettings.create({
                pf: { enabled: true, employeeContribution: 12, employerContribution: 12, wageLimit: 15000, adminCharges: 0.5, edliCharges: 0.5 },
                esi: { enabled: true, employeeContribution: 0.75, employerContribution: 3.25, wageLimit: 21000 },
                professionalTax: {
                    enabled: true, state: 'Maharashtra',
                    slabs: [
                        { minSalary: 0, maxSalary: 7500, taxAmount: 0 },
                        { minSalary: 7501, maxSalary: 10000, taxAmount: 175 },
                        { minSalary: 10001, maxSalary: 999999999, taxAmount: 200 },
                    ],
                },
                tds: {
                    enabled: true, regime: 'new', cessRate: 4,
                    newRegimeSlabs: [
                        { minIncome: 0, maxIncome: 400000, rate: 0 },
                        { minIncome: 400001, maxIncome: 800000, rate: 5 },
                        { minIncome: 800001, maxIncome: 1200000, rate: 10 },
                        { minIncome: 1200001, maxIncome: 1600000, rate: 15 },
                        { minIncome: 1600001, maxIncome: 2000000, rate: 20 },
                        { minIncome: 2000001, maxIncome: 2400000, rate: 25 },
                        { minIncome: 2400001, maxIncome: 999999999, rate: 30 },
                    ],
                    oldRegimeSlabs: [
                        { minIncome: 0, maxIncome: 250000, rate: 0 },
                        { minIncome: 250001, maxIncome: 500000, rate: 5 },
                        { minIncome: 500001, maxIncome: 1000000, rate: 20 },
                        { minIncome: 1000001, maxIncome: 999999999, rate: 30 },
                    ],
                },
                attendanceSettings: {
                    checkInTime: '09:30',
                    checkOutTime: '18:30',
                    absentThresholdMinutes: 30,
                    monthlyPermissionHours: 8,
                    maxPermissionCount: 4,
                },
                financialYear: '2025-2026',
            });
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) { next(error); }
};

// Update compliance settings
exports.updateSettings = async (req, res, next) => {
    try {
        let settings = await ComplianceSettings.findOne({ isActive: true });
        if (!settings) {
            settings = await ComplianceSettings.create(req.body);
        } else {
            Object.assign(settings, req.body);
            await settings.save();
        }
        res.status(200).json({ success: true, data: settings, message: 'Settings updated.' });
    } catch (error) { next(error); }
};

// Get PT slabs
exports.getPTSlabs = async (req, res, next) => {
    try {
        const settings = await ComplianceSettings.findOne({ isActive: true });
        res.status(200).json({ success: true, data: settings?.professionalTax?.slabs || [] });
    } catch (error) { next(error); }
};

// Update PT slabs
exports.updatePTSlabs = async (req, res, next) => {
    try {
        const settings = await ComplianceSettings.findOne({ isActive: true });
        if (!settings) return res.status(404).json({ success: false, message: 'Settings not found.' });
        settings.professionalTax.slabs = req.body.slabs;
        await settings.save();
        res.status(200).json({ success: true, data: settings.professionalTax.slabs });
    } catch (error) { next(error); }
};
