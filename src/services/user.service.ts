import User, { IUser } from '../models/User';
import Invitation from '../models/Invitation';
import { generateEmployeeId } from '../utils/generateId';
import { encrypt } from '../utils/crypto';
import crypto from 'crypto';
import { logAuditManual } from '../middleware/auditLogger';

export const createUser = async (data: any, actor: any) => {
    // 1. Validate role hierarchy
    if (actor.role === 'admin' && (data.role === 'superadmin' || data.role === 'admin')) {
        throw new Error('Admins can only create HR, Managers, and Employees');
    }
    if (actor.role === 'hr' && (data.role === 'superadmin' || data.role === 'admin' || data.role === 'hr')) {
        throw new Error('HRs can only create Managers and Employees');
    }

    // 2. Encrypt sensitive data
    if (data.bank?.accountNumber) {
        data.bank.accountNumber = encrypt(data.bank.accountNumber);
    }
    if (data.statutory?.pan) {
        data.statutory.pan = encrypt(data.statutory.pan);
    }

    // 3. Generate Organization-Scoped Employee ID
    data.employeeId = await generateEmployeeId(data.organizationId);

    const user = new User(data);
    user.createdBy = actor._id;
    await user.save();

    // 4. Create Invitation
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitation = await Invitation.create({
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        departmentId: user.departmentId,
        token: invitationToken,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        invitedBy: actor._id
    });

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        organizationId: actor.organizationId,
        action: 'CREATE_USER',
        module: 'users',
        targetId: user._id,
        targetModel: 'User',
        newValue: user.toObject(),
    });

    return { user, invitationToken };
};

export const getUsers = async (scope: any, query: any) => {
    const { page = 1, limit = 10, search = '' } = query;
    const filter = { ...scope };
    
    if (search) {
        filter.$or = [
            { firstName: new RegExp(search, 'i') },
            { lastName: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') },
            { employeeId: new RegExp(search, 'i') }
        ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ createdAt: -1 });

    return {
        users,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        }
    };
};

export const getUserById = async (id: string, scope: any) => {
    const user = await User.findOne({ _id: id, ...scope });
    if (!user) throw new Error('User not found or outside your scope');
    return user;
};
