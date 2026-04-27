import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    try {
        const decoded: any = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || '');
        
        const user = await User.findById(decoded.id).select('+employment.status');
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (user.employment.status === 'terminated') {
            return res.status(403).json({ success: false, message: 'Your account has been terminated' });
        }

        req.user = {
            _id: user._id as mongoose.Types.ObjectId,
            role: user.role,
            organizationId: user.organizationId,
            departmentId: user.departmentId
        };

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};
