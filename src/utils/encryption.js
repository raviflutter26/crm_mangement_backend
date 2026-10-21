const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Resolve the key at call time rather than at import, so scripts and tests that
 * never touch encrypted fields keep working without it — config/index.js already
 * warns at boot when it is unset in production.
 *
 * There used to be a hardcoded fallback key here. A fallback that ships in the
 * repository is not a key: anyone who can read the source could decrypt every
 * bank account number and forge MFA secrets, and a deploy that simply forgot the
 * variable would silently downgrade to it rather than say so. Refuse instead.
 */
const getKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error(
            'ENCRYPTION_KEY is not set. Bank account numbers and MFA secrets cannot be ' +
            'encrypted or decrypted without it. Set it in .env (local) or in the host\'s ' +
            'environment (production).'
        );
    }
    return key;
};

/**
 * Encrypts a string using AES-256-GCM
 * @param {string} text The plain text to encrypt
 * @returns {string} Encrypted string in format: salt:iv:authTag:encryptedText
 */
const encrypt = (text) => {
    const secretKey = getKey();
    try {
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
    const secretKey = getKey();
    try {
        const [saltHex, ivHex, authTagHex, encryptedText] = encryptedBundle.split(':');

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
