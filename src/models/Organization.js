const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String
    },
    logo: { type: String },
    industry: { type: String, required: true },
    companySize: { type: String },
    foundedYear: { type: Number },
    description: { type: String },
    planType: { type: String, default: 'Starter' },
    billingCycle: { type: String, default: 'Monthly' },
    maxEmployees: { type: Number, default: 50 },
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'pending'], default: 'active' },
    deletedAt: { type: Date, default: null },
    settings: {
        attendance: {
            workingDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            workingHours: { type: Number, default: 8 },
            graceMinutes: { type: Number, default: 15 },
            overtimeEnabled: { type: Boolean, default: false },
            halfDayHours: { type: Number, default: 4 }
        },
        payroll: {
            payDay: { type: Number, default: 1 },
            currency: { type: String, default: 'INR' },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate slug from name before saving
OrganizationSchema.pre('validate', function() {
    if (this.isModified('name')) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
});

module.exports = mongoose.model('Organization', OrganizationSchema);
