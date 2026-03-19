const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
    {
        zohoRecordId: {
            type: String,
            unique: true,
            sparse: true,
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
            enum: ['Admin', 'HR', 'Manager', 'Employee'],
            default: 'Employee',
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
        employmentType: {
            type: String,
            enum: ['Full-time', 'Contract', 'Intern', 'Part-time', 'Probation', null],
            default: 'Full-time',
        },
        // Statutory compliance fields
        panNumber: { 
            type: String, 
            default: null,
            unique: true,
            sparse: true,
            uppercase: true,
            match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN number']
        },
        aadhaar: { type: String, default: null },
        passportNumber: { type: String, default: null },
        drivingLicense: { type: String, default: null },
        uan: { type: String, default: null }, // PF Universal Account Number
        pfNumber: { type: String, default: null },
        pfJoiningDate: { type: Date, default: null },
        pfEmployeeContributionRate: { type: Number, default: 12 },
        pfEmployerContributionRate: { type: Number, default: 12 },
        esiNumber: { type: String, default: null },
        esiJoiningDate: { type: Date, default: null },
        esiDispensary: { type: String, default: null },
        pfEnabled: { type: Boolean, default: true },
        esiEnabled: { type: Boolean, default: true },
        esiSalaryLimit: { type: Number, default: 21000 },
        taxRegime: { type: String, enum: ['old', 'new', null], default: 'new' },
        salaryStructure: { type: String, default: 'Standard' },
        ctc: { type: Number, default: 0 },
        paymentCycle: { type: String, enum: ['Monthly', 'Weekly'], default: 'Monthly' },
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
