import { Request } from 'express';
import mongoose from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: mongoose.Types.ObjectId;
        role: 'superadmin' | 'admin' | 'hr' | 'manager' | 'employee';
        organizationId: mongoose.Types.ObjectId | null;
        departmentId: mongoose.Types.ObjectId | null;
      };
      scope?: any; // To be used for dynamic query filtering
    }
  }
}
