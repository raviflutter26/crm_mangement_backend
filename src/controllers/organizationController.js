const Organization = require('../models/Organization');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * @desc    Create a new organization
 * @route   POST /api/organizations
 */
exports.createOrganization = async (req, res, next) => {
    try {
        const { orgData, admin } = req.body;

        if (!orgData || !orgData.name || !orgData.email) {
            return res.status(400).json({
                success: false,
                message: 'Organization name and email are required'
            });
        }

        // Use email for uniqueness since organizationId was removed/undefined
        const email = orgData.email?.toLowerCase();
        const existingOrg = await Organization.findOne({ email });
        
        if (existingOrg) {
            return res.status(400).json({
                success: false,
                message: `Organization with email ${email} already exists`
            });
        }

        // 1. Create the organization
        const organization = await Organization.create({
            name: orgData.name,
            email: email,
            industry: orgData.industry,
            companySize: orgData.companySize,
            phone: orgData.phone,
            address: orgData.address,
            settings: orgData.settings,
            planType: orgData.planType,
            billingCycle: orgData.billingCycle,
            maxEmployees: orgData.maxEmployees,
            foundedYear: orgData.foundedYear,
            description: orgData.description
        });

        // 2. Handle Admin User Creation
        let tempPassword = admin?.password;
        if (!tempPassword) {
            tempPassword = crypto.randomBytes(4).toString('hex'); // Generate 8 char password
        }

        const adminUser = await User.create({
            firstName: admin?.firstName || 'Org',
            lastName: admin?.lastName || 'Admin',
            email: admin?.email?.toLowerCase() || email,
            password: tempPassword,
            role: 'admin',
            organizationId: organization._id,
            isFirstLogin: true,
            isPasswordSet: !!admin?.password
        });

        // 2.5 Create Employee record for the admin
        const Employee = require('../models/Employee');
        await Employee.create({
            organizationId: organization._id,
            employeeId: `EMP-${Date.now().toString().slice(-4)}`,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            email: adminUser.email,
            role: 'Admin',
            status: 'Active',
            dateOfJoining: new Date()
        });

        // 2.6 Create default departments for the organization
        const Department = require('../models/Department');
        const defaultDepts = [
            'Management', 'Human Resources', 'Sales', 'Installation', 
            'Engineering', 'Finance', 'Warehouse', 'Customer Support', 'IT'
        ];
        await Department.insertMany(defaultDepts.map(name => ({ 
            name, 
            organizationId: organization._id,
            status: 'active'
        })));

        // 3. Link organization to its creator
        organization.createdBy = adminUser._id;
        await organization.save();

        // 4. Dispatch Onboarding Email
        try {
            await sendEmail({
                to: adminUser.email,
                subject: `Welcome to Ravi Zoho - ${organization.name} Node Initialized`,
                template: 'orgOnboarding',
                data: {
                    adminName: adminUser.name,
                    orgName: organization.name,
                    portalUrl: process.env.WEBSITE_URL,
                    adminEmail: adminUser.email,
                    tempPassword: tempPassword,
                    loginUrl: `${process.env.WEBSITE_URL}/login`,
                    industry: organization.industry,
                    planType: organization.planType,
                    slug: organization.slug
                }
            });
        } catch (mailErr) {
            console.error('Failed to send onboarding email:', mailErr.message);
            // Don't fail the whole request if email fails, but log it
        }

        res.status(201).json({
            success: true,
            message: 'Organization and Admin created successfully. Onboarding email dispatched.',
            data: {
                organization,
                admin: {
                    id: adminUser._id,
                    email: adminUser.email,
                    tempPassword: admin?.password ? '********' : tempPassword
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all organizations
 * @route   GET /api/organizations
 */
exports.getOrganizations = async (req, res, next) => {
    try {
        const { search, status, planType, sort = 'newest', page = 1, limit = 10 } = req.query;
        const query = { deletedAt: null }; // Soft delete filter

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

        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { name: 1 };
        else if (sort === 'oldest') sortOption = { createdAt: 1 };

        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const skip = (p - 1) * l;

        const [data, total, activeMatching, globalTotal, globalActive] = await Promise.all([
            Organization.find(query).sort(sortOption).skip(skip).limit(l),
            Organization.countDocuments(query),
            Organization.countDocuments({ ...query, status: 'active' }),
            Organization.countDocuments({ deletedAt: null }),
            Organization.countDocuments({ deletedAt: null, status: 'active' })
        ]);

        res.status(200).json({
            success: true,
            data,
            pagination: {
                total,
                active: activeMatching,
                globalTotal,
                globalActive,
                page: p,
                limit: l,
                totalPages: Math.ceil(total / l)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update organization settings
 * @route   PUT /api/organizations/:id
 */
exports.updateOrganization = async (req, res, next) => {
    try {
        const organization = await Organization.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        res.status(200).json({
            success: true,
            data: organization
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single organization
 * @route   GET /api/organizations/:id
 */
exports.getOrganizationById = async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.params.id);
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }
        res.status(200).json({ success: true, data: organization });
    } catch (error) { next(error); }
};

/**
 * @desc    Soft delete organization
 * @route   DELETE /api/organizations/:id
 */
exports.deleteOrganization = async (req, res, next) => {
    try {
        const organization = await Organization.findByIdAndUpdate(req.params.id, { 
            deletedAt: new Date(),
            status: 'inactive'
        }, { new: true });

        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        res.status(200).json({ success: true, message: 'Organization removed successfully' });
    } catch (error) { next(error); }
};

/**
 * @desc    Update organization status
 * @route   PATCH /api/organizations/:id/status
 */
exports.updateOrganizationStatus = async (req, res, next) => {
    try {
        const organization = await Organization.findByIdAndUpdate(req.params.id, { 
            status: req.body.status 
        }, { new: true });

        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        res.status(200).json({ success: true, data: organization });
    } catch (error) { next(error); }
};

/**
 * @desc    Impersonate organization admin
 * @route   POST /api/organizations/:id/impersonate
 */
exports.impersonateOrganization = async (req, res, next) => {
    try {
        // Find primary admin for this org
        const adminUser = await User.findOne({ 
            organizationId: req.params.id, 
            role: 'admin' 
        });

        if (!adminUser) {
            return res.status(404).json({ success: false, message: 'No admin user found for this organization' });
        }

        // Generate token for the admin user
        const token = jwt.sign(
            { id: adminUser._id, role: adminUser.role, impersonatedBy: req.user.id },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.status(200).json({
            success: true,
            message: 'Impersonation successful',
            data: {
                token,
                user: {
                    id: adminUser._id,
                    name: adminUser.name,
                    role: adminUser.role,
                    organizationId: adminUser.organizationId
                }
            }
        });
    } catch (error) { next(error); }
};

// --- Designations ---
exports.getDesignations = async (req, res, next) => {
    try {
        const query = { isActive: true };
        const orgId = req.query.organizationId || (req.user && req.user.organizationId);
        if (orgId) query.organizationId = orgId;
        
        const designations = await Designation.find(query).sort({ level: 1 });
        res.status(200).json({ success: true, data: designations });
    } catch (error) { next(error); }
};

exports.createDesignation = async (req, res, next) => {
    try {
        const designation = await Designation.create({
            ...req.body,
            organizationId: req.user.organizationId
        });
        res.status(201).json({ success: true, data: designation });
    } catch (error) { next(error); }
};

// --- Branches ---
exports.getBranches = async (req, res, next) => {
    try {
        const query = { isActive: true };
        const orgId = req.query.organizationId || (req.user && req.user.organizationId);
        if (orgId) query.organizationId = orgId;

        const branches = await Branch.find(query).sort({ name: 1 });
        res.status(200).json({ success: true, data: branches });
    } catch (error) { next(error); }
};

exports.createBranch = async (req, res, next) => {
    try {
        const branch = await Branch.create({
            ...req.body,
            organizationId: req.user.organizationId
        });
        res.status(201).json({ success: true, data: branch });
    } catch (error) { next(error); }
};

// --- Holidays ---
exports.getHolidays = async (req, res, next) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const query = { year: parseInt(year) };
        const orgId = req.query.organizationId || (req.user && req.user.organizationId);
        if (orgId) query.organizationId = orgId;

        const holidays = await Holiday.find(query).sort({ date: 1 });
        res.status(200).json({ success: true, data: holidays });
    } catch (error) { next(error); }
};

exports.createHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.create({
            ...req.body,
            organizationId: req.user.organizationId
        });
        res.status(201).json({ success: true, data: holiday });
    } catch (error) { next(error); }
};
