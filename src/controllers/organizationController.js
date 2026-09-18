const Organization = require('../models/Organization');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { isSuperAdmin, requireOwnOrg, scopeFilter, withOrg } = require('../utils/tenancy');

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

        // slug is unique, so a name that normalizes to an existing slug would fail
        // mid-create with an opaque duplicate-key error. Report it up front instead.
        const slug = String(orgData.name).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        if (await Organization.findOne({ slug })) {
            return res.status(400).json({
                success: false,
                message: `Organization name '${orgData.name}' is already taken. Please use a different name.`
            });
        }

        // The admin's email is unique across users. Check before the organization is
        // created so a conflict cannot leave an organization behind with no admin.
        const adminEmail = admin?.email?.toLowerCase() || email;
        if (await User.findOne({ email: adminEmail })) {
            return res.status(400).json({
                success: false,
                message: `A user with email ${adminEmail} already exists. Please use a different admin email.`
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

        // Anything that fails from here on leaves an organization with no admin, which
        // then blocks every retry on the "email already exists" check above. Undo the
        // organization instead of stranding it.
        let adminUser;
        try {
            adminUser = await User.create({
                firstName: admin?.firstName || 'Org',
                lastName: admin?.lastName || 'Admin',
                email: adminEmail,
                password: tempPassword,
                role: 'admin',
                // The organization's first administrator predates its branches,
                // so they are group-wide by definition rather than by omission.
                isGroupWide: true,
                organizationId: organization._id,
                isFirstLogin: true,
                isPasswordSet: !!admin?.password,
                employeeId: `EMP-${Date.now().toString().slice(-4)}`,
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
        } catch (setupErr) {
            await Organization.deleteOne({ _id: organization._id }).catch(() => {});
            if (adminUser) {
                await User.deleteOne({ _id: adminUser._id }).catch(() => {});
            }
            const Department = require('../models/Department');
            await Department.deleteMany({ organizationId: organization._id }).catch(() => {});
            throw setupErr;
        }

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

        // This is the platform's customer list. Without this it returned every
        // organization on the platform — name, email and plan — to any
        // authenticated user of any tenant. A tenant user sees only their own.
        if (!isSuperAdmin(req)) {
            const own = req.user?.organizationId;
            if (!own) return res.status(200).json({ success: true, data: [], count: 0, total: 0 });
            query._id = own;
        }

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
            Organization.find(query).sort(sortOption).skip(skip).limit(l).lean(),
            Organization.countDocuments(query),
            Organization.countDocuments({ ...query, status: 'active' }),
            Organization.countDocuments({ deletedAt: null }),
            Organization.countDocuments({ deletedAt: null, status: 'active' })
        ]);

        // Attach live employee counts per organization
        const orgIds = data.map(org => org._id);
        const employeeCounts = await User.aggregate([
            { $match: { organizationId: { $in: orgIds } } },
            { $group: { _id: '$organizationId', count: { $sum: 1 } } }
        ]);
        const countByOrgId = new Map(employeeCounts.map(e => [e._id.toString(), e.count]));
        const dataWithCounts = data.map(org => ({
            ...org,
            employeeCount: countByOrgId.get(org._id.toString()) || 0
        }));

        res.status(200).json({
            success: true,
            data: dataWithCounts,
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
        // An org Admin may only edit their own organization; :id is client-supplied.
        if (!requireOwnOrg(req, res, req.params.id)) return;

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
        if (!requireOwnOrg(req, res, req.params.id)) return;

        const organization = await Organization.findById(req.params.id).lean();
        if (!organization) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }
        const employeeCount = await User.countDocuments({ organizationId: organization._id });
        res.status(200).json({ success: true, data: { ...organization, employeeCount } });
    } catch (error) { next(error); }
};

/**
 * @desc    Soft delete organization
 * @route   DELETE /api/organizations/:id
 */
exports.deleteOrganization = async (req, res, next) => {
    try {
        // Removing a tenant is a platform action, never a tenant-level one.
        if (!isSuperAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Only a superadmin can remove an organization.' });
        }

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
        // Suspending or reactivating a tenant is a platform action.
        if (!isSuperAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Only a superadmin can change organization status.' });
        }

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
        // This mints a valid session for another organization's admin. Behind a
        // tenant-level role it is a complete cross-tenant account takeover, so it
        // must be superadmin-only.
        if (!isSuperAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Only a superadmin can impersonate an organization.' });
        }

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
        // Never read the tenant off the query string: any signed-in user could
        // pass another organization's id and receive its rows. scopeFilter takes
        // the tenant from the token and honours the superadmin exception.
        Object.assign(query, scopeFilter(req));
        
        const designations = await Designation.find(query).sort({ level: 1 });
        res.status(200).json({ success: true, data: designations });
    } catch (error) { next(error); }
};

exports.createDesignation = async (req, res, next) => {
    try {
        const designation = await Designation.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: designation });
    } catch (error) { next(error); }
};

// --- Branches ---
exports.getBranches = async (req, res, next) => {
    try {
        const query = { isActive: true };
        // Never read the tenant off the query string: any signed-in user could
        // pass another organization's id and receive its rows. scopeFilter takes
        // the tenant from the token and honours the superadmin exception.
        Object.assign(query, scopeFilter(req));

        const branches = await Branch.find(query).sort({ name: 1 });
        res.status(200).json({ success: true, data: branches });
    } catch (error) { next(error); }
};

exports.createBranch = async (req, res, next) => {
    try {
        const branch = await Branch.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: branch });
    } catch (error) { next(error); }
};

// --- Holidays ---
exports.getHolidays = async (req, res, next) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const query = { year: parseInt(year) };
        // Never read the tenant off the query string: any signed-in user could
        // pass another organization's id and receive its rows. scopeFilter takes
        // the tenant from the token and honours the superadmin exception.
        Object.assign(query, scopeFilter(req));

        const holidays = await Holiday.find(query).sort({ date: 1 });
        res.status(200).json({ success: true, data: holidays });
    } catch (error) { next(error); }
};

exports.createHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: holiday });
    } catch (error) { next(error); }
};
