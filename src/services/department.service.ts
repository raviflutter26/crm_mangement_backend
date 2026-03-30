import Department, { IDepartment } from '../models/Department';
import User from '../models/User';
import { logAuditManual } from '../middleware/auditLogger';

export const createDepartment = async (data: any, actor: any) => {
    // Validate manager must match org
    if (data.managerId) {
        const manager = await User.findOne({ _id: data.managerId, organizationId: data.organizationId });
        if (!manager) throw new Error('Selected manager must belong to the organization');
        if (manager.role !== 'manager') throw new Error('User must have Manager role');
    }

    const dept = new Department({ ...data, createdBy: actor._id });
    await dept.save();

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        organizationId: actor.organizationId,
        action: 'CREATE_DEPARTMENT',
        module: 'departments',
        targetId: dept._id,
        targetModel: 'Department',
        newValue: dept.toObject(),
    });

    return dept;
};

export const getDepartments = async (scope: any) => {
    return await Department.find(scope).populate('managerId', 'firstName lastName email');
};

export const updateDepartment = async (id: string, scope: any, data: any, actor: any) => {
    const dept = await Department.findOne({ _id: id, ...scope });
    if (!dept) throw new Error('Department not found or unauthorized');

    const previousValue = dept.toObject();
    Object.assign(dept, data);
    await dept.save();

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        organizationId: actor.organizationId,
        action: 'UPDATE_DEPARTMENT',
        module: 'departments',
        targetId: dept._id,
        targetModel: 'Department',
        previousValue,
        newValue: dept.toObject(),
    });

    return dept;
};
