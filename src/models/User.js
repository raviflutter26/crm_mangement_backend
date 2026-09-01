const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt } = require('../utils/encryption');

const userSchema = new mongoose.Schema(
    {
        zohoRecordId: {
            type: String,
            unique: true,
            sparse: true,
        },
        employeeId: {
            type: String,
            unique: true,
            sparse: true,
        },
        profilePhoto: {
            type: String,
            default: null,
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: false,
            select: false,
        },
        role: {
            type: String,
            enum: ['superadmin', 'admin', 'hr', 'manager', 'employee', 'Admin', 'HR', 'Manager', 'Employee'],
            default: 'employee',
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null
        },
        zohoEmployeeId: {
            type: String,
            default: null,
        },
        department: {
            type: String,
            default: null,
        },
        designation: {
            type: String,
            default: null,
        },
        phone: {
            type: String,
            default: null,
        },
        panNumber: {
            type: String,
            sparse: true,
            unique: true,
            uppercase: true,
            match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN number']
        },
        avatar: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isFirstLogin: {
            type: Boolean,
            default: true,
        },
        isPasswordSet: {
            type: Boolean,
            default: false,
        },
        loginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: {
            type: Number,
            default: null,
        },
        resetPasswordToken: String,
        resetPasswordExpire: Date,
        // MFA (TOTP) — opt-in, off by default so existing logins are unaffected.
        mfaEnabled: {
            type: Boolean,
            default: false,
        },
        mfaSecret: {
            type: String,
            select: false,
        },
        mfaBackupCodes: {
            type: [String],
            select: false,
            default: [],
        },
        reportingManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        shift: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shift',
            default: null,
        },
        dateOfJoining: {
            type: Date,
            default: null,
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },
        gender: {
            type: String,
            enum: ['Male', 'Female', 'Other', null],
            default: null,
        },
        maritalStatus: {
            type: String,
            default: null,
        },
        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
            default: null,
        },
        nationality: {
            type: String,
            default: 'Indian',
        },
        employmentType: {
            type: String,
            enum: ['Full-time', 'Contract', 'Intern', 'Part-time', 'Probation', null],
            default: 'Full-time',
        },
        statutory: {
            pf: {
                enabled: { type: Boolean, default: true },
                uanNumber: { type: String, default: null },
                pfNumber: { type: String, default: null },
                pfJoiningDate: { type: Date, default: null },
                employeeContributionRate: { type: Number, default: 12 },
                employerContributionRate: { type: Number, default: 12 },
                contributionPreferences: {
                    includeEmployerPF: { type: Boolean, default: true },
                    includeEDLI: { type: Boolean, default: true },
                    includeAdminCharges: { type: Boolean, default: true }
                },
                allowOverride: { type: Boolean, default: false },
                proRateRestrictedPFWage: { type: Boolean, default: true },
                considerComponentsOnLOP: { type: Boolean, default: true },
                eligibleForABRY: { type: Boolean, default: false }
            },
            esi: {
                enabled: { type: Boolean, default: true },
                esiNumber: { type: String, default: null },
                esiJoiningDate: { type: Date, default: null },
                deductionCycle: { type: String, default: 'Monthly' },
                salaryLimit: { type: Number, default: 21000 },
                dispensary: { type: String, default: null }
            },
            pt: {
                enabled: { type: Boolean, default: true },
                ptRegistrationNumber: { type: String, default: null },
                deductionCycle: { type: String, default: 'Half Yearly' }
            },
            lwf: {
                enabled: { type: Boolean, default: true },
                lwfAccountNumber: { type: String, default: null },
                deductionCycle: { type: String, default: 'Yearly' }
            },
            statutoryBonus: {
                enabled: { type: Boolean, default: true },
                bonusAmount: { type: Number, default: 0 }
            }
        },
        taxRegime: { type: String, enum: ['old', 'new', null], default: 'new' },
        salaryStructure: { type: String, default: 'Standard' },
        ctc: { type: Number, default: 0 },
        paymentCycle: { type: String, enum: ['Monthly', 'Weekly'], default: 'Monthly' },
        zohoRoleId: {
            type: String,
            default: null,
        },
        zohoRole: {
            type: String,
            enum: ['Admin', 'Manager', 'Employee', null],
            default: null,
        },
        status: {
            type: String,
            enum: ['Active', 'Probation', 'Notice Period', 'Terminated', 'On Leave', 'Inactive'],
            default: 'Active',
        },
        location: {
            type: String,
            default: null,
        },
        address: {
            currentAddress: String,
            permanentAddress: String,
            city: String,
            state: String,
            country: String,
            zipCode: String,
            pincode: {
                type: String,
                match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
            },
        },
        bankDetails: {
            accountHolderName: { type: String, trim: true },
            encryptedAccountNumber: { type: String },
            ifscCode: { type: String, uppercase: true, trim: true },
            bankName: { type: String },
            branchName: { type: String },
            upiId: { type: String, trim: true },
            verificationStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
            cancelledCheque: { type: String },
        },
        salary: {
            basic: { type: Number, default: 0 },
            hra: { type: Number, default: 0 },
            da: { type: Number, default: 0 },
            ta: { type: Number, default: 0 },
            specialAllowance: { type: Number, default: 0 },
            grossSalary: { type: Number, default: 0 },
            netSalary: { type: Number, default: 0 },
        },
        aadhaar: {
            type: String,
            default: null,
        },
        passportNumber: {
            type: String,
            default: null,
        },
        drivingLicense: {
            type: String,
            default: null,
        },
        documents: [
            {
                name: String,
                type: String,
                url: String,
                uploadedAt: { type: Date, default: Date.now },
            },
        ],
        emergencyContact: {
            name: String,
            relationship: String,
            phone: String,
        },
        workExperience: [
            {
                jobTitle: { type: String },
                employer: { type: String },
                fromDate: { type: Date },
                toDate: { type: Date },
                description: { type: String },
            },
        ],
        expertise: {
            type: [String],
            default: [],
        },
        education: [
            {
                degree: { type: String },
                institution: { type: String },
                year: { type: Number },
                specialization: { type: String },
            },
        ],
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        modifiedIPAddress: {
            type: String,
            default: null,
        },
        syncedFromZoho: {
            type: Boolean,
            default: false,
        },
        lastSyncedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userSchema.index({ department: 1 });
userSchema.index({ status: 1 });

userSchema.virtual('name').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for getting/setting decrypted bank account number
userSchema.virtual('bankDetails.accountNumber')
    .get(function () {
        if (!this.bankDetails?.encryptedAccountNumber) return '';
        try {
            return decrypt(this.bankDetails.encryptedAccountNumber);
        } catch (err) {
            return '********';
        }
    })
    .set(function (value) {
        if (value) {
            this.bankDetails.encryptedAccountNumber = encrypt(value);
        }
    });

userSchema.pre('save', async function () {
    if (!this.password || !this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    
    // Check if the stored password is a bcrypt hash
    const isHash = this.password.startsWith('$2b$') || this.password.startsWith('$2a$');
    
    if (isHash) {
        return await bcrypt.compare(candidatePassword, this.password);
    }
    
    // Fallback for plain text passwords in legacy/test data
    return candidatePassword === this.password;
};

module.exports = mongoose.model('User', userSchema);
