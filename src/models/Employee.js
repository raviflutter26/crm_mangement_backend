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
        reportingManager: {
            type: String,
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
            enum: ['Full-time', 'Part-time', 'Contract', 'Intern', null],
            default: null,
        },
        // Statutory compliance fields
        pan: { type: String, default: null },
        aadhaar: { type: String, default: null },
        uan: { type: String, default: null }, // PF Universal Account Number
        esiNumber: { type: String, default: null },
        pfEnabled: { type: Boolean, default: true },
        esiEnabled: { type: Boolean, default: true },
        taxRegime: { type: String, enum: ['old', 'new', null], default: 'new' },
        salaryStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryStructure', default: null },
        ctc: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Terminated', 'On Leave'],
            default: 'Active',
        },
        location: {
            type: String,
            default: null,
        },
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String,
        },
        bankDetails: {
            bankName: String,
            accountNumber: String,
            ifscCode: String,
            branchName: String,
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

module.exports = mongoose.model('Employee', employeeSchema);
