const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
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
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userSchema.virtual('name').get(function () {
    return `${this.firstName} ${this.lastName}`;
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
