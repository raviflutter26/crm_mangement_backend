import mongoose from 'mongoose';
import Organization, { IOrganization } from '../models/Organization';
import User from '../models/User';
const Employee = require('../models/Employee');
const { sendEmail } = require('./emailService');
import { logAuditManual } from '../middleware/auditLogger';
import { generateAccessToken } from '../utils/jwt';

export const createOrganization = async (orgData: any, adminData: any, actor: any) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Create Organization
        // Pre-validate to ensure slug is generated before we use it for employeeId
        const org = new Organization(orgData);
        await org.validate(); 
        await org.save({ session });

        // 2. Resolve Admin User (Single Super Admin Logic)
        const superAdminCount = await User.countDocuments({ role: 'superadmin' });
        
        // 3. Create Employee (Admin)
        const employeeId = `${(org.slug || 'ORG').toUpperCase()}-ADM-001`;
        
        const employeeRecord = new Employee({
            organizationId: org._id,
            employeeId,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email?.toLowerCase() || "",
            phone: adminData.phone || null,
            role: 'admin',
            designation: adminData.designation || 'Organization Admin',
            panNumber: 'PENDING', 
            department: 'Administration',
        });
        await employeeRecord.save({ session });

        // 4. Create User (Admin) if not exists
        // If superAdminCount is 1, we still create a dedicated Admin user for the org
        // but linked to the superadmin email if they provided it.
        let userRecord = await User.findOne({ email: adminData.email.toLowerCase() });
        
        if (!userRecord) {
            userRecord = new User({
                firstName: adminData.firstName,
                lastName: adminData.lastName,
                email: adminData.email.toLowerCase(),
                role: 'admin',
                organizationId: org._id,
                password: null, // Force set password on first login
                auth: {
                    isFirstLogin: true,
                    isEmailVerified: false,
                }
            });
            await userRecord.save({ session });
        } else {
            // Link existing user to this organization if they are not already linked
            if (!userRecord.organizationId) {
                userRecord.organizationId = org._id as any;
                userRecord.role = 'admin';
                await userRecord.save({ session });
            }
        }

        // 5. Audit Log
        if (actor) {
            logAuditManual({
                actorId: actor._id,
                actorRole: actor.role,
                action: 'CREATE_ORGANIZATION_WITH_ADMIN',
                module: 'organizations',
                targetId: org._id,
                targetModel: 'Organization',
                newValue: { org: org.toObject(), adminEmail: adminData.email },
            });
        }

        // 6. Send Email
        if (adminData.sendWelcomeEmail !== false) {
            try {
                await sendEmail({
                    to: adminData.email,
                    subject: `Welcome to ${org.name}`,
                    template: 'welcomeEmployee',
                    data: {
                        employeeName: `${adminData.firstName} ${adminData.lastName}`,
                        companyName: org.name,
                        loginUrl: `${process.env.WEBSITE_URL}/login`,
                        employeeId: employeeId,
                    }
                });
            } catch (err) {
                console.error('Failed to send welcome email to new org admin', err);
            }
        }

        await session.commitTransaction();
        session.endSession();

        return org;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

export const updateOrganization = async (id: string, data: any, actor: any) => {
    const org = await Organization.findById(id);
    if (!org) throw new Error('Organization not found');

    const previousValue = org.toObject();
    Object.assign(org, data);
    await org.save();

    logAuditManual({
        actorId: actor._id,
        actorRole: actor.role,
        action: 'UPDATE_ORGANIZATION',
        module: 'organizations',
        targetId: org._id,
        targetModel: 'Organization',
        previousValue,
        newValue: org.toObject(),
    });

    return org;
};

interface OrgQueryOptions {
    search?: string;
    status?: string;
    planType?: string;
    sort?: string;
    page?: number;
    limit?: number;
}

export const getAllOrganizations = async (options: OrgQueryOptions = {}) => {
    const { search, status, planType, sort = 'newest', page = 1, limit = 10 } = options;
    const query: any = { deletedAt: null }; // Soft delete filter

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { slug: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (status && status !== 'All') {
        query.status = status.toLowerCase();
    }
    
    if (planType && planType !== 'All') {
        query.planType = planType;
    }

    let sortOption: any = { createdAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    else if (sort === 'oldest') sortOption = { createdAt: 1 };

    const skip = (page - 1) * limit;

    const [data, total, activeMatching, globalTotal, globalActive] = await Promise.all([
        Organization.find(query).sort(sortOption).skip(skip).limit(limit),
        Organization.countDocuments(query),
        Organization.countDocuments({ ...query, status: 'active' }),
        Organization.countDocuments({ deletedAt: null }),
        Organization.countDocuments({ deletedAt: null, status: 'active' })
    ]);

    return {
        data,
        pagination: {
            total,
            active: activeMatching,
            globalTotal,
            globalActive,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const getOrganizationById = async (id: string) => {
    const org = await Organization.findById(id);
    if (!org) throw new Error('Organization not found');
    return org;
};

export const deleteOrganization = async (id: string, actor: any) => {
    const org = await Organization.findById(id);
    if (!org) throw new Error('Organization not found');

    org.deletedAt = new Date();
    org.status = 'inactive';
    await org.save();

    if (actor) {
        logAuditManual({
            actorId: actor._id,
            actorRole: actor.role,
            action: 'DELETE_ORGANIZATION',
            module: 'organizations',
            targetId: org._id,
            targetModel: 'Organization',
            previousValue: { status: 'active', deletedAt: null },
            newValue: { status: 'inactive', deletedAt: org.deletedAt },
        });
    }

    return org;
};

export const updateOrganizationStatus = async (id: string, status: string, actor: any) => {
    const org = await Organization.findById(id);
    if (!org) throw new Error('Organization not found');

    const previousStatus = org.status;
    org.status = status as any;
    await org.save();

    if (actor) {
        logAuditManual({
            actorId: actor._id,
            actorRole: actor.role,
            action: 'UPDATE_ORGANIZATION_STATUS',
            module: 'organizations',
            targetId: org._id,
            targetModel: 'Organization',
            previousValue: { status: previousStatus },
            newValue: { status: org.status },
        });
    }

    return org;
};

export const impersonateOrganizationAdmin = async (orgId: string, superAdminId: string) => {
    // Find the primary admin User for this org
    const adminUser = await User.findOne({ organizationId: orgId, role: 'admin' });
    if (!adminUser) throw new Error('No Organization Admin found for this organization');

    const token = generateAccessToken(adminUser._id as any, adminUser.role, superAdminId as any);
    
    return { token, user: adminUser };
};
