const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
    {
        zohoRecordId: {
            type: String,
            unique: true,
            sparse: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: false, // Temporary for transition
        },
        employeeId: {
            type: String,
            required: true,
            unique: true,
        },
        profilePhoto: {
            type: String,
            default: null,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        phone: {
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
        role: {
            type: String,
            enum: ['superadmin', 'admin', 'hr', 'manager', 'employee', 'Admin', 'HR', 'Manager', 'Employee'],
            default: 'employee',
        },
        reportingManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
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
        panNumber: {
            type: String,
            default: null,
            trim: true,
        },
        employmentType: {
            type: String,
            enum: ['Full-time', 'Contract', 'Intern', 'Part-time', 'Probation', null],
            default: 'Full-time',
        },
        statutory: {
            pf: {
                enabled: { type: Boolean, default: true },
                uanNumber: { type: String, default: null }, // 12 digits
                pfNumber: { type: String, default: null },
                pfJoiningDate: { type: Date, default: null },
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
                salaryLimit: { type: Number, default: 21000 }
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
            encryptedAccountNumber: { type: String }, // AES-256-GCM encrypted
            ifscCode: { type: String, uppercase: true, trim: true },
            bankName: { type: String },
            branchName: { type: String },
            upiId: { type: String, trim: true },
            verificationStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
            cancelledCheque: { type: String }, // File path or URL
        },
        salary: {
            basic: { type: Number, default: 0 },
            hra: { type: Number, default: 0 },
            da: { type: Number, default: 0 },
            specialAllowance: { type: Number, default: 0 },
            grossSalary: { type: Number, default: 0 },
            netSalary: { type: Number, default: 0 },
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
        collection: 'solar_employees',
    }
);

// Virtual for full name
employeeSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Indexes
employeeSchema.index({ department: 1 });
employeeSchema.index({ status: 1 });

const { encrypt, decrypt } = require('../utils/encryption');

const Employee = mongoose.model('Employee', employeeSchema);

// Virtual for getting/setting decrypted account number
employeeSchema.virtual('bankDetails.accountNumber')
    .get(function() {
        if (!this.bankDetails?.encryptedAccountNumber) return '';
        try {
            return decrypt(this.bankDetails.encryptedAccountNumber);
        } catch (err) {
            return '********'; // Return masked if decryption fails
        }
    })
    .set(function(value) {
        if (value) {
            this.bankDetails.encryptedAccountNumber = encrypt(value);
        }
    });

// Ensure virtuals are included in toJSON and toObject
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = Employee;
