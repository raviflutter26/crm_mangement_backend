const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');

/**
 * Generate JWT token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });
        
        if (user) {
            // IF it's a new employee created by HR but password not set, allow them to "register" (set password)
            if (!user.password || user.isFirstLogin) {
                user.password = password;
                user.isFirstLogin = false;
                if (name) user.name = name;
                await user.save();
                
                const token = generateToken(user._id);
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
        }

        user = await User.create({ name, email, password, role });

        const token = generateToken(user._id);

        res.status(201).json({
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
            
            const token = generateToken(user._id);
            return res.status(200).json({
                success: true,
                message: 'Account activated and password set successfully!',
                data: {
                    user: {
                        id: user._id,
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

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
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
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
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

        const token = generateToken(user._id);

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


        res.status(200).json({
            success: true,
            message: 'Password reset successful',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    designation: user.designation,
                },
                token: generateToken(user._id)
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

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Password created successfully. You are now logged in.',
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
    } catch (error) {
        next(error);
    }
};
