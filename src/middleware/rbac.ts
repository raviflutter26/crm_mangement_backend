import { Request, Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';

/**
 * Enforce minimum role requirements for a route.
 */
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // Log unauthorized attempt
            if (req.user) {
                AuditLog.create({
                    actorId: req.user._id,
                    actorRole: req.user.role,
                    organizationId: req.user.organizationId,
                    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
                    module: req.originalUrl,
                    targetId: req.user._id,
                    targetModel: 'System',
                    newValue: { path: req.path, method: req.method },
                    timestamp: new Date()
                }).catch(console.error);
            }
            
            return res.status(403).json({ 
                success: false, 
                message: `User role '${req.user?.role}' is not authorized to access this route` 
            });
        }
        next();
    };
};

/**
 * Specifically block SuperAdmin from employee-specific routes.
 */
export const denySuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'superadmin') {
        return res.status(403).json({
            success: false,
            message: 'Super Admin cannot access employee-specific modules (Payroll, Attendance, Leaves)'
        });
    }
    next();
};

/**
 * Injects scoping filters into req.scope based on the user's role.
 * Downstream controllers must use req.scope in their queries.
 */
export const authorizeScope = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const role = req.user.role;
    let scope: any = {};

    switch (role) {
        case 'superadmin':
            scope = {}; // Platform owner sees everything across all orgs
            break;
        case 'admin':
        case 'hr':
            scope = { organizationId: req.user.organizationId };
            break;
        case 'manager':
            // Managers see their department OR their own record
            scope = { 
                $or: [
                    { departmentId: req.user.departmentId },
                    { _id: req.user._id }
                ],
                organizationId: req.user.organizationId 
            };
            break;
        case 'employee':
            scope = { _id: req.user._id };
            break;
        default:
            return res.status(403).json({ success: false, message: 'Invalid role scope' });
    }

    req.scope = scope;
    next();
};
