const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM
 * @param {string} text The plain text to encrypt
 * @returns {string} Encrypted string in format: salt:iv:authTag:encryptedText
 */
const encrypt = (text) => {
    try {
        const secretKey = process.env.ENCRYPTION_KEY || 'v6yB8pL9xR4mQ2nZ5jH3kF1aD7sW0eT9'; // Should be 32 chars
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        // Derive key using PBKDF2
        const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Encryption failed');
    }
};

/**
 * Decrypts a string encrypted with the above encrypt function
 * @param {string} encryptedBundle The string in format salt:iv:authTag:encryptedText
 * @returns {string} Decrypted plain text
 */
const decrypt = (encryptedBundle) => {
    try {
        const [saltHex, ivHex, authTagHex, encryptedText] = encryptedBundle.split(':');
        
        const secretKey = process.env.ENCRYPTION_KEY || 'v6yB8pL9xR4mQ2nZ5jH3kF1aD7sW0eT9';
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Decryption failed. Data might be corrupted or key is incorrect.');
    }
};

/**
 * Masks an account number showing only the last 4 digits
 * @param {string} accountNumber 
 */
const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
};

module.exports = {
    encrypt,
    decrypt,
    maskAccountNumber
};
