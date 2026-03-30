import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'hr' | 'manager' | 'employee';
  organizationId: mongoose.Types.ObjectId | null; // null only for superadmin
  departmentId: mongoose.Types.ObjectId | null;
  managerId: mongoose.Types.ObjectId | null;
  reportingTo?: mongoose.Types.ObjectId;
  
  profile: {
    phone?: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    avatar?: string;
    bloodGroup?: string;
  };
  
  employment: {
    designation?: string;
    employmentType?: 'full-time' | 'part-time' | 'contract' | 'intern';
    dateOfJoining?: Date;
    dateOfLeaving?: Date;
    status: 'active' | 'inactive' | 'terminated' | 'on-leave';
    shiftId?: string;
    workLocation?: string;
  };
  
  salary: {
    ctc: number;
    basic: number;
    hra: number;
    da: number;
    specialAllow: number;
    pf: number;
    esi: number;
    tds: number;
    professionalTax: number;
    lwf: number;
  };
  
  bank: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    accountHolder?: string;
  };
  
  statutory: {
    pan?: string;
    uan?: string;
    esiNumber?: string;
    pfNumber?: string;
    pfJoiningDate?: Date;
  };
  
  auth: {
    isEmailVerified: boolean;
    inviteToken?: string;
    inviteTokenExpiry?: Date;
    passwordResetToken?: string;
    passwordResetExpiry?: Date;
    isFirstLogin: boolean;
    lastLogin?: Date;
    refreshToken?: string;
  };
  
  permissions: {
    module: string;
    actions: string[];
  }[];
  
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  employeeId: { type: String }, // Scoped per organization
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, select: false },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'hr', 'manager', 'employee'],
    required: true
  },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reportingTo: { type: Schema.Types.ObjectId, ref: 'User' },
  
  profile: {
    phone: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: String,
    avatar: String,
    bloodGroup: String
  },
  
  employment: {
    designation: String,
    employmentType: { type: String, enum: ['full-time', 'part-time', 'contract', 'intern'] },
    dateOfJoining: Date,
    dateOfLeaving: Date,
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'terminated', 'on-leave'], 
        default: 'active' 
    },
    shiftId: String,
    workLocation: String
  },
  
  salary: {
    ctc: { type: Number, default: 0 },
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    da: { type: Number, default: 0 },
    specialAllow: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    lwf: { type: Number, default: 0 }
  },
  
  bank: {
    accountNumber: String, // To be encrypted
    ifscCode: String,
    bankName: String,
    accountHolder: String
  },
  
  statutory: {
    pan: String, // To be encrypted
    uan: String,
    esiNumber: String,
    pfNumber: String,
    pfJoiningDate: Date
  },
  
  auth: {
    isEmailVerified: { type: Boolean, default: false },
    inviteToken: String,
    inviteTokenExpiry: Date,
    passwordResetToken: String,
    passwordResetExpiry: Date,
    isFirstLogin: { type: Boolean, default: true },
    lastLogin: Date,
    refreshToken: String
  },
  
  permissions: [{
    module: String,
    actions: [String]
  }],
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// UserSchema.index({ email: 1 }); // Redundant, email has unique: true above
UserSchema.index({ organizationId: 1, departmentId: 1 });
UserSchema.index({ role: 1 });

// Ensure Super Admin has no organization
UserSchema.pre('save', function(this: IUser) {
    if (this.role === 'superadmin') {
        this.organizationId = null;
    } else if (!this.organizationId) {
        // All other roles MUST have an organization
        throw new Error('Organization ID is required for non-superadmin users');
    }
});

// Password hashing pre-save hook
UserSchema.pre('save', async function(this: IUser) {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password as string, salt);
});

export default mongoose.model<IUser>('User', UserSchema);
