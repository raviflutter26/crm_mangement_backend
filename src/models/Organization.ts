import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
    // Identity
    name: string;
    slug: string;
    industry?: string;
    companySize?: string;
    foundedYear?: number;
    description?: string;
    logo?: string;
    website?: string;
    
    // Contact & Location
    email: string;
    phone?: string;
    address: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };

    // Lifecycle
    status: 'active' | 'inactive' | 'suspended' | 'trial';
    deletedAt?: Date | null;
    
    // Subscription & Plan
    planType?: 'Free' | 'Starter' | 'Professional' | 'Enterprise';
    billingCycle?: 'Monthly' | 'Quarterly' | 'Annually';
    trialEndDate?: Date;
    maxEmployees?: number;
    features?: {
        payroll?: boolean;
        leave?: boolean;
        attendance?: boolean;
        reports?: boolean;
        apiAccess?: boolean;
    };
    settings: {
        attendance: {
            timezone?: string;
            workingDays: string[];
            workingHours: number;
            graceMinutes: number;
            overtimeEnabled: boolean;
            overtimePolicy?: string;
            halfDayHours: number;
            weekStart?: string;
            breakDuration?: number;
            defaultStartTime?: string;
            defaultEndTime?: string;
        };
        payroll: {
            payDay: number;
            currency: string;
            payrollCycle?: string;
            fiscalYearStart?: number;
            epfEnabled: boolean;
            esiEnabled: boolean;
            ptEnabled: boolean;
            lwfEnabled: boolean;
            tdsEnabled: boolean;
            autoPayrollEnabled: boolean;
        };
        shifts: {
            name: string;
            startTime: string;
            endTime: string;
            isDefault: boolean;
        }[];
        leave: {
            casualLeave: number;
            sickLeave: number;
            earnedLeave: number;
            carryForward: boolean;
        };
    };
    createdBy: mongoose.Types.ObjectId;
}

const OrganizationSchema: Schema = new Schema({
    // Identity
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true },
    industry: { type: String },
    companySize: { type: String },
    foundedYear: { type: Number },
    description: { type: String },
    logo: { type: String },
    website: { type: String },

    // Contact & Location
    email: { type: String, unique: true, required: true },
    phone: { type: String },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String
    },

    // Lifecycle
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'trial'], default: 'active' },
    deletedAt: { type: Date, default: null },

    // Subscription & Plan
    planType: { type: String, enum: ['Free', 'Starter', 'Professional', 'Enterprise'], default: 'Free' },
    billingCycle: { type: String, enum: ['Monthly', 'Quarterly', 'Annually'], default: 'Monthly' },
    trialEndDate: { type: Date },
    maxEmployees: { type: Number },
    features: {
        payroll: { type: Boolean, default: false },
        leave: { type: Boolean, default: true },
        attendance: { type: Boolean, default: true },
        reports: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
    },
    settings: {
        attendance: {
            timezone: { type: String, default: 'Asia/Kolkata' },
            workingDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            workingHours: { type: Number, default: 8 },
            graceMinutes: { type: Number, default: 15 },
            overtimeEnabled: { type: Boolean, default: false },
            overtimePolicy: { type: String, default: 'None' },
            halfDayHours: { type: Number, default: 4 },
            weekStart: { type: String, default: 'Mon' },
            breakDuration: { type: Number, default: 60 },
            defaultStartTime: { type: String, default: '09:00' },
            defaultEndTime: { type: String, default: '18:00' }
        },
        payroll: {
            payDay: { type: Number, default: 1 },
            currency: { type: String, default: 'INR' },
            payrollCycle: { type: String, default: 'Monthly' },
            fiscalYearStart: { type: Number, default: 4 }, // 4 = April
            epfEnabled: { type: Boolean, default: true },
            esiEnabled: { type: Boolean, default: true },
            ptEnabled: { type: Boolean, default: true },
            lwfEnabled: { type: Boolean, default: true },
            tdsEnabled: { type: Boolean, default: true },
            autoPayrollEnabled: { type: Boolean, default: false }
        },
        shifts: [{
            name: String,
            startTime: String,
            endTime: String,
            isDefault: Boolean
        }],
        leave: {
            casualLeave: { type: Number, default: 12 },
            sickLeave: { type: Number, default: 6 },
            earnedLeave: { type: Number, default: 15 },
            carryForward: { type: Boolean, default: false }
        }
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate slug from name before saving
OrganizationSchema.pre('validate', function(this: IOrganization, next: any) {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    next();
});

export default mongoose.model<IOrganization>('Organization', OrganizationSchema);
