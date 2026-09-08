const mongoose = require('mongoose');

const statutoryConfigSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true,
        index: true,
    },
    // Legacy key from before tenant scoping existed. Left optional so documents written
    // by the old code still load; organizationId is the source of truth.
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    epf: {
        epfEnabled: { type: Boolean, default: true },
        epfNumber: { type: String, default: 'CB/SLM/2972534/000' },
        deductionCycle: { type: String, default: 'Monthly' },
        employeeContributionRate: { type: Number, default: 12 },
        employerContributionMode: { 
            type: String, 
            enum: ['Restrict to ₹15,000 of PF Wage', 'Actual PF Wage'],
            default: 'Restrict to ₹15,000 of PF Wage' 
        },
        employerPFWageLimit: { type: Number, default: 15000 },
        includedInCTC: {
            employerPFContribution: { type: Boolean, default: true },
            edliContribution: { type: Boolean, default: true },
            adminCharges: { type: Boolean, default: true }
        },
        allowEmployeeLevelOverride: { type: Boolean, default: false },
        proRateRestrictedPFWage: { type: Boolean, default: true },
        considerSalaryComponentsOnLOP: { type: Boolean, default: true },
        eligibleForABRYScheme: { type: Boolean, default: false },
        // EPS pensionable wage ceiling — 8.33% of this is the monthly EPS cap.
        epsWageCeiling: { type: Number, default: 15000 },
        // Organization-wide default; override per employee via
        // User.statutory.pf.higherPensionOptedIn.
        higherPensionOptedIn: { type: Boolean, default: false }
    },
    esi: {
        esiEnabled: { type: Boolean, default: true },
        esiNumber: { type: String, default: '56-00-140218-000-0607' },
        esiDeductionCycle: { type: String, default: 'Monthly' },
        employeeContribution: { type: Number, default: 0.75 },
        employerContribution: { type: Number, default: 3.25 },
        esiSalaryLimit: { type: Number, default: 21000 },
        esiJoiningDate: { type: Date }
    },
    professionalTax: {
        ptEnabled: { type: Boolean, default: true },
        ptRegistrationNumber: { type: String },
        ptState: { type: String, default: 'Tamil Nadu' },
        ptDeductionCycle: { type: String, default: 'Half Yearly' },
        ptSlabs: [
            {
                minSalary: { type: Number },
                maxSalary: { type: Number }, // null means no upper limit
                taxAmount: { type: Number },
                frequency: { type: String, enum: ['monthly', 'halfYearly', 'yearly'], default: 'monthly' }
            }
        ]
    },
    labourWelfareFund: {
        lwfEnabled: { type: Boolean, default: true },
        lwfAccountNumber: { type: String },
        lwfState: { type: String, default: 'Tamil Nadu' },
        lwfDeductionCycle: { type: String, default: 'Yearly' },
        employeeContribution: { type: Number, default: 20 },
        employerContribution: { type: Number, default: 40 },
        lwfStatus: { type: String, default: 'Enabled' }
    },
    statutoryBonus: {
        statutoryBonusEnabled: { type: Boolean, default: true },
        bonusPercentage: { type: Number, default: 8.33 },
        minimumWage: { type: Number },
        eligibilityLimit: { type: Number, default: 21000 },
        paymentFrequency: { type: String, default: 'Yearly' }
    }
}, {
    timestamps: true,
    collection: 'statutory_configs'
});

const StatutoryConfig = mongoose.model('StatutoryConfig', statutoryConfigSchema);

module.exports = StatutoryConfig;
