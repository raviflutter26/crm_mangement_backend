const Department = require('../models/Department');
const Branch = require('../models/Branch');
const {
    scopeFilter,
    withScope,
    requireOrg,
    canAccessBranch,
} = require('../utils/tenancy');

/**
 * Departments live inside a branch, so every handler here scopes on both.
 *
 * The filter comes from scopeFilter rather than being built by hand. The
 * hand-rolled version this replaces read
 *
 *     req.query.organizationId || req.user.organizationId
 *
 * which trusted a client-supplied tenant id from ANY caller — a signed-in
 * employee of one tenant could read another tenant's departments by passing
 * ?organizationId=<other>, and a caller with neither value got {}, matching
 * every department in every tenant. scopeFilter honours the superadmin
 * exception and otherwise fails closed.
 */

/**
 * The branch to stamp on a new department, or null after sending a response.
 *
 * Unlike requireBranch this consults the organization's default branch before
 * giving up, because a single-branch customer should not have to name the only
 * branch they have on every create.
 */
const resolveBranch = async (req, res, orgId) => {
    const requested = req.body?.branchId;

    if (requested) {
        if (!canAccessBranch(req, requested)) {
            res.status(403).json({ success: false, message: 'Not authorized for this branch.' });
            return null;
        }
        return String(requested);
    }

    const allowed = (req.user?.branchIds || []).filter(Boolean).map(String);
    if (allowed.length === 1) return allowed[0];

    // Unrestricted caller, or one holding several branches: fall back to the
    // organization's default branch, which the migration guarantees exists.
    const fallback = await Branch.findOne({ organizationId: orgId, isDefault: true }).select('_id').lean();
    if (fallback) return String(fallback._id);

    res.status(400).json({ success: false, message: 'Branch context is missing. Name a branchId.' });
    return null;
};

const DEFAULT_DEPARTMENTS = [
    'Management', 'Human Resources', 'Sales', 'Installation',
    'Engineering', 'Finance', 'Warehouse', 'Customer Support', 'IT',
];

/**
 * Create the default departments for an organization that has none.
 *
 * Only ever runs when the organization is genuinely empty, and only into its
 * default branch — seeding branchless rows would make them unreadable through
 * scopeFilter(req, { branch: true }), which is how every read here now runs.
 * Returns false (rather than throwing) when there is no organization or no
 * branch to seed into, so a read never fails because a seed could not run.
 */
const seedDefaults = async (req) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return false;

    const branch = await Branch.findOne({ organizationId: orgId, isDefault: true }).select('_id').lean()
        || await Branch.findOne({ organizationId: orgId }).sort({ createdAt: 1 }).select('_id').lean();
    if (!branch) return false;

    try {
        await Department.insertMany(
            DEFAULT_DEPARTMENTS.map(name => ({
                name,
                organizationId: orgId,
                branchId: branch._id,
                status: 'active',
            })),
            { ordered: false } // keep going past duplicates from a concurrent request
        );
    } catch {
        // A concurrent request won the race; the re-read below still returns rows.
    }
    return true;
};

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res, next) => {
    try {
        const filter = { ...scopeFilter(req, { branch: true }) };
        if (req.query.branchId && canAccessBranch(req, req.query.branchId)) {
            filter.branchId = req.query.branchId;
        }

        let departments = await Department.find(filter).sort({ name: 1 });

        // Self-healing seed for an organization that has never had departments,
        // preserved from before this controller was scoped. It now stamps the
        // default branch: departments belong to a branch, and rows created
        // without one are invisible to every branch-narrowed read.
        if (departments.length === 0) {
            const seeded = await seedDefaults(req);
            if (seeded) departments = await Department.find(filter).sort({ name: 1 });
        }

        res.status(200).json({ success: true, data: departments });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private (Admin/HR)
exports.createDepartment = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const branchId = await resolveBranch(req, res, orgId);
        if (!branchId) return;

        const { isActive, ...rest } = req.body;
        // withScope strips any client-supplied organizationId/branchId before
        // stamping the validated ones.
        const payload = withScope(req, { ...rest, branchId }, { branch: true });
        payload.branchId = branchId;
        payload.status = isActive === false ? 'inactive' : 'active';

        const department = await Department.create(payload);
        res.status(201).json({ success: true, data: department });
    } catch (error) {
        next(error);
    }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private (Admin/HR)
exports.updateDepartment = async (req, res, next) => {
    try {
        const { isActive, organizationId, branchId, ...rest } = req.body;
        const updatePayload = { ...rest };
        if (isActive !== undefined) updatePayload.status = isActive === false ? 'inactive' : 'active';

        // Moving a department between branches is allowed only into a branch the
        // caller also holds, so a branch admin cannot push a department out of
        // their own reach or pull one in from a branch they cannot see.
        if (branchId) {
            if (!canAccessBranch(req, branchId)) {
                return res.status(403).json({ success: false, message: 'Not authorized for this branch.' });
            }
            updatePayload.branchId = branchId;
        }

        const department = await Department.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req, { branch: true }) },
            updatePayload,
            { new: true, runValidators: true }
        );

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found in your organization' });
        }

        res.status(200).json({ success: true, data: department });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private (Admin)
exports.deleteDepartment = async (req, res, next) => {
    try {
        const department = await Department.findOneAndDelete({
            _id: req.params.id,
            ...scopeFilter(req, { branch: true }),
        });

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found in your organization' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
