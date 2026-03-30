import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || '';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || '';
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

export const generateAccessToken = (id: mongoose.Types.ObjectId, role: string, impersonatorId?: mongoose.Types.ObjectId) => {
    const payload: any = { id, role };
    if (impersonatorId) payload.impersonatorId = impersonatorId;
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRE,
    });
};

export const generateRefreshToken = (id: mongoose.Types.ObjectId) => {
    return jwt.sign({ id }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRE,
    });
};

export const verifyRefreshToken = (token: string) => {
    try {
        return jwt.verify(token, REFRESH_TOKEN_SECRET) as { id: string };
    } catch (err) {
        return null;
    }
};
