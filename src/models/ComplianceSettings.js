const mongoose = require('mongoose');

const complianceSettingsSchema = new mongoose.Schema(
    {
        // PF Settings
        pf: {
            enabled: { type: Boolean, default: true },
            employeeContribution: { type: Number, default: 12 }, // %
            employerContribution: { type: Number, default: 12 }, // %
            wageLimit: { type: Number, default: 15000 }, // Monthly wage ceiling
            adminCharges: { type: Number, default: 0.5 }, // %
            edliCharges: { type: Number, default: 0.5 }, // %
        },
        // ESI Settings
        esi: {
            enabled: { type: Boolean, default: true },
            employeeContribution: { type: Number, default: 0.75 }, // %
            employerContribution: { type: Number, default: 3.25 }, // %
            wageLimit: { type: Number, default: 21000 }, // Monthly wage ceiling
        },
        // Professional Tax Settings (state-wise)
        professionalTax: {
            enabled: { type: Boolean, default: true },
            state: { type: String, default: 'Maharashtra' },
            slabs: [
                {
                    minSalary: { type: Number, default: 0 },
                    maxSalary: { type: Number, default: 999999999 },
                    taxAmount: { type: Number, default: 200 },
                },
            ],
        },
        // TDS / Income Tax Settings
        tds: {
            enabled: { type: Boolean, default: true },
            regime: { type: String, enum: ['old', 'new'], default: 'new' },
            surchargeThreshold: { type: Number, default: 5000000 },
            cessRate: { type: Number, default: 4 }, // Health & Education Cess %
            newRegimeSlabs: [
                { minIncome: Number, maxIncome: Number, rate: Number },
            ],
            oldRegimeSlabs: [
                { minIncome: Number, maxIncome: Number, rate: Number },
            ],
        },
        // LWF (Labour Welfare Fund)
        lwf: {
            enabled: { type: Boolean, default: false },
            employeeContribution: { type: Number, default: 0 },
            employerContribution: { type: Number, default: 0 },
        },
        // Attendance Settings
        attendanceSettings: {
            checkInTime: { type: String, default: '09:30' },
            checkOutTime: { type: String, default: '18:30' },
            absentThresholdMinutes: { type: Number, default: 30 },
            monthlyPermissionHours: { type: Number, default: 8 }, // Total hours allowed per month
            maxPermissionCount: { type: Number, default: 4 }, // Max number of applications per month
        },
        // Company info
        companyName: { type: String, default: '' },
        pfRegistrationNumber: { type: String, default: '' },
        esiRegistrationNumber: { type: String, default: '' },
        tanNumber: { type: String, default: '' },
        financialYear: { type: String, default: '2025-2026' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ComplianceSettings', complianceSettingsSchema);
