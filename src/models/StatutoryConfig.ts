import mongoose, { Schema, Document } from 'mongoose';

export interface IStatutoryConfig extends Document {
    organizationId: mongoose.Types.ObjectId;
    epf: {
        epfEnabled: boolean;
        epfNumber: string;
        deductionCycle: string;
        employeeContributionRate: number;
        employerContributionMode: 'Restrict to ₹15,000 of PF Wage' | 'Actual PF Wage';
        employerPFWageLimit: number;
        includedInCTC: {
            employerPFContribution: boolean;
            edliContribution: boolean;
            adminCharges: boolean;
        };
        allowEmployeeLevelOverride: boolean;
        proRateRestrictedPFWage: boolean;
        considerSalaryComponentsOnLOP: boolean;
        eligibleForABRYScheme: boolean;
    };
    esi: {
        esiEnabled: boolean;
        esiNumber: string;
        esiDeductionCycle: string;
        employeeContribution: number;
        employerContribution: number;
        esiSalaryLimit: number;
        esiJoiningDate?: Date;
    };
    professionalTax: {
        ptEnabled: boolean;
        ptRegistrationNumber?: string;
        ptState: string;
        ptDeductionCycle: string;
        ptSlabs: Array<{
            minSalary: number;
            maxSalary: number | null;
            taxAmount: number;
            frequency: 'monthly' | 'halfYearly' | 'yearly';
        }>;
    };
    labourWelfareFund: {
        lwfEnabled: boolean;
        lwfAccountNumber?: string;
        lwfState: string;
        lwfDeductionCycle: string;
        employeeContribution: number;
        employerContribution: number;
        lwfStatus: string;
    };
    statutoryBonus: {
        statutoryBonusEnabled: boolean;
        bonusPercentage: number;
        minimumWage?: number;
        eligibilityLimit: number;
        paymentFrequency: string;
    };
}

const statutoryConfigSchema = new Schema<IStatutoryConfig>({
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true
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
        eligibleForABRYScheme: { type: Boolean, default: false }
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
                maxSalary: { type: Number },
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

export default mongoose.model<IStatutoryConfig>('StatutoryConfig', statutoryConfigSchema);
