import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // For GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a string in the format: iv:authTag:encryptedValue
 */
export const encrypt = (text: string): string => {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be a 32-byte hex string');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a string produced by the encrypt function.
 */
export const decrypt = (encryptedData: string): string => {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encryptedText) {
        throw new Error('Invalid encrypted data format');
    }

    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
};
