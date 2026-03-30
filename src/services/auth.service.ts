import { Request } from 'express';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import Invitation from '../models/Invitation';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { logAuditManual } from '../middleware/auditLogger';

export const loginUser = async (email: string, password: string, req: Request) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
        throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    if (user.employment.status === 'terminated') {
        throw new Error('Account deactivated');
    }

    // Update last login
    user.auth.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id as any, user.role);
    const refreshToken = generateRefreshToken(user._id as any);

    // Audit Log
    logAuditManual({
        actorId: user._id,
        actorRole: user.role,
        organizationId: user.organizationId,
        action: 'LOGIN',
        module: 'auth',
        targetId: user._id,
        targetModel: 'User',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    return { user, accessToken, refreshToken };
};

export const setupPasswordFromInvite = async (token: string, password: string, req: Request) => {
    const invite = await Invitation.findOne({ token, status: 'pending' });
    if (!invite || invite.expiresAt < new Date()) {
        throw new Error('Invalid or expired invitation token');
    }

    const user = await User.findOne({ email: invite.email, organizationId: invite.organizationId });
    if (!user) {
        throw new Error('Associated user not found');
    }

    user.password = password;
    user.auth.isFirstLogin = false;
    user.auth.isEmailVerified = true;
    user.employment.status = 'active';
    await user.save();

    invite.status = 'accepted';
    await invite.save();

    logAuditManual({
        actorId: user._id,
        actorRole: user.role,
        organizationId: user.organizationId,
        action: 'SETUP_PASSWORD',
        module: 'auth',
        targetId: user._id,
        targetModel: 'User',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    const accessToken = generateAccessToken(user._id as any, user.role);
    const refreshToken = generateRefreshToken(user._id as any);

    return { user, accessToken, refreshToken };
};
