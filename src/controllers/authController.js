const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const User = require('../models/User');
const Session = require('../models/Session');
const SsoConfig = require('../models/SsoConfig');
const config = require('../config');
const { sendEmail } = require('../services/emailService');
const { encrypt, decrypt } = require('../utils/encryption');
const crypto = require('crypto');

/**
 * Generate JWT token. Pass a jti to make the token revocable via Session tracking;
 * tokens without one (or issued before Session tracking existed) remain valid as before.
 */
const generateToken = (id, jti) => {
    const payload = jti ? { id, jti } : { id };
    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};

const parseDurationMs = (str) => {
    const match = /^(\d+)([smhd])$/.exec(String(str || '').trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
    return n * mult;
};

/**
 * Issue a token AND record a Session for it, so it can be listed/revoked later.
 * Purely additive: existing callers that don't use this keep working unchanged.
 */
const issueSession = async (user, req) => {
    const jti = crypto.randomBytes(16).toString('hex');
    const token = generateToken(user._id, jti);
    try {
        await Session.create({
            userId: user._id,
            jti,
            userAgent: req?.headers?.['user-agent'] || null,
            ipAddress: req?.ip || null,
            lastActiveAt: new Date(),
            expiresAt: new Date(Date.now() + parseDurationMs(config.jwt.expiresIn)),
        });
    } catch (err) {
        console.error('Session creation failed (token issued anyway):', err.message);
    }
    return token;
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
exports.register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // This endpoint only activates a pre-existing account (created by an admin/hr user
        // via the Add Employee flow, or by org creation) — it never creates a brand-new
        // employee record itself, since that would bypass organization scoping and the
        // per-org employee plan limit.
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'No pending account found for this email. Ask your administrator to add you as an employee first.' });
        }

        if (!user.password || user.isFirstLogin) {
            user.password = password;
            user.isFirstLogin = false;
            if (name) user.name = name;
            await user.save();

            const token = await issueSession(user, req);
            return res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    },
                    token,
                },
            });
        }

        return res.status(400).json({ success: false, message: 'Email already registered.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            return res.status(401).json({ 
                success: false, 
                message: `Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.` 
            });
        }

        // AUTO-SETUP: IF no password set yet, set it now and login
        if (!user.password) {
            user.password = password;
            user.isFirstLogin = false;
            user.isPasswordSet = true;
            user.loginAttempts = 0;
            user.lockUntil = null;
            user.lastLogin = Date.now();
            await user.save(); // Password will be hashed by pre-save middleware

            const token = await issueSession(user, req);
            return res.status(200).json({
                success: true,
                message: 'Account activated and password set successfully!',
                data: {
                    user: {
                        id: user._id,
                        employeeId: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        designation: user.designation,
                    },
                    token,
                },
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            // Increment failed attempts
            user.loginAttempts += 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes lock
                user.loginAttempts = 0; // Reset attempts after lock
            }
            await user.save({ validateBeforeSave: false });
            
            return res.status(401).json({ 
                success: false, 
                message: user.lockUntil ? 'Too many failed attempts. Account locked for 30 minutes.' : 'Invalid credentials.' 
            });
        }

        // Reset failed attempts on success
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.isFirstLogin = false;
        user.isPasswordSet = true;
        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        // MFA is opt-in (off by default) — only users who've enabled it hit this branch.
        if (user.mfaEnabled) {
            const preAuthToken = jwt.sign({ id: user._id, mfaPending: true }, config.jwt.secret, { expiresIn: '10m' });
            return res.status(200).json({
                success: true,
                data: { mfaRequired: true, preAuthToken },
            });
        }

        const token = await issueSession(user, req);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    employeeId: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    designation: user.designation,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Complete login when MFA is required
 * @route   POST /api/auth/mfa/challenge
 */
exports.mfaChallenge = async (req, res, next) => {
    try {
        const { preAuthToken, code } = req.body;
        if (!preAuthToken || !code) {
            return res.status(400).json({ success: false, message: 'preAuthToken and code are required.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(preAuthToken, config.jwt.secret);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Invalid or expired MFA session. Please log in again.' });
        }
        if (!decoded.mfaPending) {
            return res.status(401).json({ success: false, message: 'Invalid MFA session.' });
        }

        const user = await User.findById(decoded.id).select('+mfaSecret +mfaBackupCodes');
        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            return res.status(401).json({ success: false, message: 'MFA is not enabled for this account.' });
        }

        const secret = decrypt(user.mfaSecret);
        let isValid = authenticator.verify({ token: code, secret });

        // Fall back to a one-time backup code if the TOTP code doesn't match.
        if (!isValid) {
            const hash = crypto.createHash('sha256').update(code).digest('hex');
            const idx = (user.mfaBackupCodes || []).indexOf(hash);
            if (idx !== -1) {
                isValid = true;
                user.mfaBackupCodes.splice(idx, 1);
            }
        }

        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }

        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastLogin = Date.now();
        await user.save({ validateBeforeSave: false });

        const token = await issueSession(user, req);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    employeeId: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    designation: user.designation,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Start MFA setup — generates a TOTP secret and QR code (not enabled until verified)
 * @route   POST /api/auth/mfa/setup
 */
exports.mfaSetup = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const secret = authenticator.generateSecret();
        user.mfaSecret = encrypt(secret);
        await user.save({ validateBeforeSave: false });

        const otpauth = authenticator.keyuri(user.email, 'Ravi Zoho HRMS', secret);
        const qrCode = await QRCode.toDataURL(otpauth);

        res.status(200).json({ success: true, data: { qrCode, secret } });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Verify a TOTP code and enable MFA
 * @route   POST /api/auth/mfa/verify
 */
exports.mfaVerify = async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Verification code is required.' });

        const user = await User.findById(req.user.id).select('+mfaSecret');
        if (!user || !user.mfaSecret) {
            return res.status(400).json({ success: false, message: 'MFA setup has not been started.' });
        }

        const secret = decrypt(user.mfaSecret);
        const isValid = authenticator.verify({ token: code, secret });
        if (!isValid) return res.status(400).json({ success: false, message: 'Invalid verification code.' });

        const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
        user.mfaBackupCodes = backupCodes.map(c => crypto.createHash('sha256').update(c).digest('hex'));
        user.mfaEnabled = true;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({ success: true, message: 'MFA enabled.', data: { backupCodes } });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Disable MFA (requires current password)
 * @route   POST /api/auth/mfa/disable
 */
exports.mfaDisable = async (req, res, next) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id).select('+password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect password.' });

        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        user.mfaBackupCodes = [];
        await user.save({ validateBeforeSave: false });

        res.status(200).json({ success: true, message: 'MFA disabled.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    List active sessions for the current user
 * @route   GET /api/auth/sessions
 */
exports.getSessions = async (req, res, next) => {
    try {
        const sessions = await Session.find({ userId: req.user.id, revoked: false }).sort('-lastActiveAt');
        const data = sessions.map(s => ({
            _id: s._id,
            userAgent: s.userAgent,
            ipAddress: s.ipAddress,
            lastActiveAt: s.lastActiveAt,
            createdAt: s.createdAt,
            current: s.jti === req.jti,
        }));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/auth/sessions/:id
 */
exports.revokeSession = async (req, res, next) => {
    try {
        const session = await Session.findOne({ _id: req.params.id, userId: req.user.id });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
        session.revoked = true;
        session.revokedAt = new Date();
        await session.save();
        res.status(200).json({ success: true, message: 'Session revoked.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Revoke all other sessions (keeps the caller's current session active)
 * @route   POST /api/auth/sessions/revoke-all
 */
exports.revokeAllSessions = async (req, res, next) => {
    try {
        await Session.updateMany(
            { userId: req.user.id, revoked: false, jti: { $ne: req.jti } },
            { revoked: true, revokedAt: new Date() }
        );
        res.status(200).json({ success: true, message: 'All other sessions revoked.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get SSO configuration for the org (settings only — no live provider connection)
 * @route   GET /api/auth/sso-config
 */
exports.getSsoConfig = async (req, res, next) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });
        const found = await SsoConfig.findOne({ organizationId: orgId });
        const data = found ? found.toObject() : { organizationId: orgId, provider: 'none', enabled: false };
        res.status(200).json({ success: true, data: { ...data, connected: false } });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Save SSO configuration for the org (settings only — no live provider connection)
 * @route   PUT /api/auth/sso-config
 */
exports.updateSsoConfig = async (req, res, next) => {
    try {
        const orgId = req.user.organizationId;
        if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });
        const { provider, enabled, clientId, domain, metadataUrl, notes } = req.body;
        const updated = await SsoConfig.findOneAndUpdate(
            { organizationId: orgId },
            { provider, enabled, clientId, domain, metadataUrl, notes, updatedBy: req.user.id },
            { new: true, upsert: true, runValidators: true }
        );
        res.status(200).json({
            success: true,
            data: { ...updated.toObject(), connected: false },
            message: 'SSO configuration saved. No live connection is established until real credentials are verified with your identity provider.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({
            success: true, 
            data: { 
                ...user, 
                employeeId: user._id 
            } 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update profile
 * @route   PUT /api/auth/profile
 */
exports.updateProfile = async (req, res, next) => {
    try {
        const { name, phone, avatar } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, phone, avatar },
            { new: true, runValidators: true }
        );
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id).select('+password');

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        user.password = newPassword;
        await user.save();

        const token = await issueSession(user, req);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully.',
            data: { token },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/auth/users
 */
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update user role/status (Admin only)
 * @route   PUT /api/auth/users/:id
 */
exports.updateUser = async (req, res, next) => {
    try {
        const { role, isActive } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role, isActive },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'There is no user with that email' });
        }

        // Get reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        
        // Hash token and set to resetPasswordToken field
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set expire (24 hours)
        user.resetPasswordExpire = Date.now() + 24 * 60 * 60 * 1000;

        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetUrl = `${process.env.WEBSITE_URL}/reset-password/${resetToken}`;

        try {
            await sendEmail({
                to: user.email,
                subject: 'Password Reset Token',
                template: 'passwordReset',
                data: {
                    employeeName: user.name,
                    resetUrl: resetUrl
                }
            });

            res.status(200).json({ success: true, message: 'Email sent' });
        } catch (err) {
            console.log(err);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save({ validateBeforeSave: false });

            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Verify reset token and get user email
 * @route   GET /api/auth/reset-password/:resettoken
 */
exports.verifyResetToken = async (req, res, next) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid token or token expired' });
        }

        res.status(200).json({
            success: true,
            data: {
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:resettoken
 */
exports.resetPassword = async (req, res, next) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid token or token expired' });
        }

        // Set new password
        user.password = req.body.password;
        user.isFirstLogin = false; // Mark password as set
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        const token = await issueSession(user, req);

        res.status(200).json({
            success: true,
            message: 'Password reset successful',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    designation: user.designation,
                },
                token
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    First time password setup
 * @route   POST /api/auth/create-password
 */
exports.createPassword = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.password) {
            return res.status(400).json({ success: false, message: 'Password already set. Use login or forgot password.' });
        }

        user.password = password;
        user.isFirstLogin = false;
        await user.save();

        const token = await issueSession(user, req);

        res.status(200).json({
            success: true,
            message: 'Password created successfully. You are now logged in.',
            data: {
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};
