import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';

/**
 * Middleware to log a generic action.
 * For complex updates with prev/next values, it's better to use the logAction utility directly in controllers.
 */
export const auditLog = (action: string, module: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;
        
        // Override res.send to capture the response and log after send
        res.send = function (body: any): Response {
            if (req.user) {
                AuditLog.create({
                    actorId: req.user._id,
                    actorRole: req.user.role,
                    organizationId: req.user.organizationId as any,
                    action,
                    module,
                    targetId: req.params.id || req.user._id, // Default to self or param ID
                    targetModel: module.charAt(0).toUpperCase() + module.slice(1, -1), // Rough guess
                    newValue: req.body,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date()
                }).catch(console.error);
            }
            return originalSend.call(this, body);
        };
        
        next();
    };
};

/**
 * Utility to log detailed changes (Prev vs New).
 * Usually called from within controllers after a successful DB operation.
 */
export const logAuditManual = async (payload: {
    actorId: any;
    actorRole: string;
    organizationId?: any;
    action: string;
    module: string;
    targetId: any;
    targetModel: string;
    previousValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
}) => {
    try {
        await AuditLog.create({
            ...payload,
            timestamp: new Date()
        });
    } catch (err) {
        console.error('Audit Log Error:', err);
    }
};
