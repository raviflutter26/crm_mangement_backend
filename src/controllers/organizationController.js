const Organization = require('../models/Organization');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Holiday = require('../models/Holiday');

/**
 * @desc    Create a new organization
 * @route   POST /api/organizations
 */
exports.createOrganization = async (req, res, next) => {
    try {
        const { name, organizationId, workingDays, timezone, attendanceSettings } = req.body;

        const existingOrg = await Organization.findOne({ organizationId: organizationId.toLowerCase() });
        if (existingOrg) {
            return res.status(400).json({ success: false, message: 'Organization ID already exists' });
        }

        const organization = await Organization.create({
            name,
            organizationId: organizationId.toLowerCase(),
            workingDays,
            timezone,
            attendanceSettings
        });

        res.status(201).json({
            success: true,
            data: organization
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
        const organizations = await Organization.find({ isActive: true });
        res.status(200).json({
            success: true,
            data: organizations
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

// --- Designations ---
exports.getDesignations = async (req, res, next) => {
    try {
        const designations = await Designation.find({ isActive: true });
        res.status(200).json({ success: true, data: designations });
    } catch (error) { next(error); }
};

exports.createDesignation = async (req, res, next) => {
    try {
        const designation = await Designation.create(req.body);
        res.status(201).json({ success: true, data: designation });
    } catch (error) { next(error); }
};

// --- Branches ---
exports.getBranches = async (req, res, next) => {
    try {
        const branches = await Branch.find({ isActive: true });
        res.status(200).json({ success: true, data: branches });
    } catch (error) { next(error); }
};

exports.createBranch = async (req, res, next) => {
    try {
        const branch = await Branch.create(req.body);
        res.status(201).json({ success: true, data: branch });
    } catch (error) { next(error); }
};

// --- Holidays ---
exports.getHolidays = async (req, res, next) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const holidays = await Holiday.find({ year: parseInt(year) }).sort({ date: 1 });
        res.status(200).json({ success: true, data: holidays });
    } catch (error) { next(error); }
};

exports.createHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.create(req.body);
        res.status(201).json({ success: true, data: holiday });
    } catch (error) { next(error); }
};
