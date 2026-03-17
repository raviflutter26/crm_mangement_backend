const mongoose = require('mongoose');
const { encrypt, decrypt, maskAccountNumber } = require('../utils/encryption');

const bankDetailSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        unique: true
    },
    accountHolderName: {
        type: String,
        required: true,
        trim: true
    },
    // We store the encrypted version in the database
    encryptedAccountNumber: {
        type: String,
        required: true
    },
    // IFSC is usually public knowledge, but we can encrypt it too if desired. 
    // Here we'll keep it plain for easier lookup but masked in UI.
    ifscCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true
    },
    lastFourDigits: {
        type: String,
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Middleware to automatically set last four digits before saving
bankDetailSchema.pre('save', function(next) {
    if (this.isModified('encryptedAccountNumber')) {
        // We can't get last 4 from encrypted directly if we just changed it, 
        // so this assumes the controller passes them or we decrypt if we have the plain text temporarily.
        // Actually, better to have a virtual setter or just set it in controller.
    }
    next();
});

// Virtual for decrypted account number (to be used sparingly)
bankDetailSchema.virtual('accountNumber').get(function() {
    return decrypt(this.encryptedAccountNumber);
});

module.exports = mongoose.model('BankDetail', bankDetailSchema);
