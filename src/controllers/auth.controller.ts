import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { sendResponse, sendError } from '../utils/apiResponse';

/**
 * Login User
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return sendError(res, 400, 'Please provide email and password', 'VALIDATION_ERROR');
        }

        const { user, accessToken, refreshToken } = await authService.loginUser(email, password, req);

        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        return sendResponse(res, 200, 'Login successful', {
            user,
            accessToken
        });
    } catch (err: any) {
        return sendError(res, 401, err.message, 'AUTH_ERROR');
    }
};

/**
 * Setup Password from Invite
 * POST /api/auth/setup-password
 */
export const setupPassword = async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return sendError(res, 400, 'Token and password are required', 'VALIDATION_ERROR');
        }

        const { user, accessToken, refreshToken } = await authService.setupPasswordFromInvite(token, password, req);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return sendResponse(res, 200, 'Account setup successful', {
            user,
            accessToken
        });
    } catch (err: any) {
        return sendError(res, 400, err.message, 'BAD_REQUEST');
    }
};

/**
 * Get Current User
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    
    return sendResponse(res, 200, 'User profile fetched', req.user);
};

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response) => {
    res.clearCookie('refreshToken');
    // In a full prod app, we'd also blacklist the access token in Redis here
    return sendResponse(res, 200, 'Logged out successfully');
};
