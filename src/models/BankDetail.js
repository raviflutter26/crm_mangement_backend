const mongoose = require('mongoose');
const { encrypt, decrypt, maskAccountNumber } = require('../utils/encryption');

const bankDetailSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
        ref: 'User'
    }
}, {
    timestamps: true
});

// Middleware to automatically set last four digits before saving
// Mongoose 9 removed the `next` callback style for middleware: the hook is
// called with no arguments and whatever it returns is awaited.
// The body is intentionally empty: lastFourDigits is set by the controller,
// which still holds the plaintext account number. Kept as a placeholder for
// where that derivation would move if the plaintext ever reaches the model.
bankDetailSchema.pre('save', function () {});

// Virtual for decrypted account number (to be used sparingly)
bankDetailSchema.virtual('accountNumber').get(function() {
    return decrypt(this.encryptedAccountNumber);
});

module.exports = mongoose.model('BankDetail', bankDetailSchema);
