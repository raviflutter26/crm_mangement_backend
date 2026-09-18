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
        // Roles are stored lowercase. The enum previously carried both casings
        // ('hr' and 'HR'), which meant every comparison had to remember to
        // normalize first; the setter below makes that impossible to forget.
        // 'owner' is the tenant-level role: the customer's own top administrator,
        // above branch admins and below the platform superadmin.
        role: {
            type: String,
            enum: ['superadmin', 'owner', 'admin', 'hr', 'manager', 'employee'],
            default: 'employee',
            set: (v) => (v == null ? v : String(v).toLowerCase()),
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            default: null
        },
        // The branch this person is posted to — where they actually work. This
        // is what stamps their attendance, leave and payroll rows, and what
        // decides which state's PT slabs apply to them.
        //
        // Distinct from branchIds below: this is WHERE THEY ARE, that is WHAT
        // THEY CAN SEE. For an employee the two coincide, but an admin posted
        // at Chennai may administer Chennai and Bangalore both.
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
        },
        // Branches this user may act in. Empty means every branch in their
        // organization, which is the correct reading for an owner, for a
        // group-wide HR, and for every user created before branches existed.
        // See src/utils/tenancy.js for how this narrows reads.
        branchIds: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
            default: [],
        },
        // Makes "every branch" a deliberate grant rather than a blank field.
        //
        // An empty branchIds reads as "every branch in my organization" (see
        // branchIdsFor), which is correct for an owner and for a genuine
        // group-wide HR — and silently wrong for a branch admin or branch HR
        // who was simply created before anyone assigned their branches. Those
        // two roles now need either a branch or this flag; without one,
        // branch-narrowed reads resolve to no rows instead of to the whole
        // organization. See scopeFilter in src/utils/tenancy.js.
        //
        // Deliberately NOT enforced by a schema validator: an organization's
        // very first admin is created during signup, before any branch exists
        // (see organizationController), and every pre-branch row would fail to
        // save. The migration marks existing branch roles explicitly instead.
        isGroupWide: {
            type: Boolean,
            default: false,
        },
        // The department a manager is scoped to. Managers still approve only
        // their direct reports (see reportingManager); this widens what they can
        // *see* to their whole department.
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            default: null,
        },
        zohoEmployeeId: {
            type: String,
            default: null,
        },
        // Legacy free-text department name, predating the Department collection.
        // Kept because reports and Zoho sync still read it; `departmentId` above
        // is the authoritative link. Backfilled by src/scripts/migrateToBranchScope.js.
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
                eligibleForABRY: { type: Boolean, default: false },
                // Set only for employees who opted for higher pension on actual
                // wages (Nov 2022 Supreme Court ruling). When false, EPS is
                // capped at 8.33% of the ₹15,000 pensionable wage ceiling.
                higherPensionOptedIn: { type: Boolean, default: false }
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
userSchema.index({ organizationId: 1, branchId: 1 });
userSchema.index({ organizationId: 1, branchIds: 1 });
userSchema.index({ organizationId: 1, departmentId: 1 });

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

// A restricted user cannot be posted to a branch they may not act in. An empty
// branchIds is unrestricted, so it satisfies this trivially — which is why every
// pre-branch user and every owner passes.
userSchema.path('branchId').validate(function (value) {
    if (!value) return true;
    const allowed = (this.branchIds || []).filter(Boolean).map(String);
    return allowed.length === 0 || allowed.includes(String(value));
}, 'Posting branch must be one of the branches this user may act in.');

// Normalize casing on documents written before the enum was lowercased, so an
// untouched legacy row can still be saved. Setters do not run on hydration,
// which is why this cannot be left to the `set` on `role`.
userSchema.post('init', function () {
    if (this.role && this.role !== String(this.role).toLowerCase()) {
        this.role = String(this.role).toLowerCase();
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
