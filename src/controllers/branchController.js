const Branch = require('../models/Branch');
const Department = require('../models/Department');
const User = require('../models/User');
const {
    scopeFilter,
    withOrg,
    requireOrg,
    branchIdsFor,
    canAccessBranch,
    isSuperAdmin,
} = require('../utils/tenancy');
const { logAction } = require('../utils/auditLogger');

/**
 * The branch-addressed API the scoping helpers were written for.
 *
 * Until this existed, Branch had a model, a migration and a seed but no route:
 * branches could be created by a script and never listed, and the guards built
 * to protect branch-addressed requests (authorizeBranch, requireBranch,
 * canAccessBranch) had nothing to guard. A UI cannot offer a branch switcher
 * for branches it cannot fetch.
 *
 * Branch is unusual among scoped collections: its OWN _id is the branch, so it
 * has no branchId field to filter on and scopeFilter(req, { branch: true })
 * does not apply. Confinement is expressed as _id ∈ branchIds instead.
 */

/** Branches this caller may see: their own, or all of their org's if unrestricted. */
const visibleBranchFilter = (req) => {
    const filter = { ...scopeFilter(req) };
    const held = branchIdsFor(req);
    if (held.length) filter._id = { $in: held };
    return filter;
};

/**
 * The filter for one branch addressed by id.
 *
 * Written as an explicit membership test rather than
 * `{ _id: id, ...visibleBranchFilter(req) }`: both objects carry an `_id` key,
 * so the spread silently overwrote the requested id with the caller's held set
 * — a findOneAndUpdate that then edited the WRONG branch instead of matching
 * nothing. Returns null when the caller may not reach the branch at all.
 */
const oneBranchFilter = (req, id) => {
    if (!canAccessBranch(req, id)) return null;
    return { ...scopeFilter(req), _id: id };
};

// @desc    List branches the caller may act in
// @route   GET /api/branches
// @access  Private (any authenticated tenant user)
exports.getBranches = async (req, res, next) => {
    try {
        const branches = await Branch.find(visibleBranchFilter(req)).sort({ name: 1 });
        res.status(200).json({ success: true, count: branches.length, data: branches });
    } catch (error) {
        next(error);
    }
};

// @desc    Get one branch
// @route   GET /api/branches/:id
// @access  Private
exports.getBranch = async (req, res, next) => {
    try {
        const filter = oneBranchFilter(req, req.params.id);
        if (!filter) return res.status(403).json({ success: false, message: 'Not authorized for this branch.' });

        const branch = await Branch.findOne(filter);
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });
        res.status(200).json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a branch
// @route   POST /api/branches
// @access  Private (owner; superadmin may target a tenant)
exports.createBranch = async (req, res, next) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        // Creating a branch widens the organization, so it is an owner-level act
        // even though editing one is a branch-level act. A branch admin who could
        // create branches could mint themselves scope they were never granted.
        const branch = await Branch.create(withOrg(req, req.body));

        await logAction(req.user?._id, 'Branch Created', 'Organization', {
            branchId: String(branch._id), name: branch.name, state: branch.state,
        }, req);

        res.status(201).json({ success: true, data: branch });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: 'A branch with that name already exists in this organization.' });
        }
        next(error);
    }
};

// @desc    Update a branch
// @route   PUT /api/branches/:id
// @access  Private (admin for branches they hold, owner for any)
exports.updateBranch = async (req, res, next) => {
    try {
        // authorizeBranch on the route refuses a branch the caller does not hold;
        // oneBranchFilter repeats the check so a route mounted without the guard
        // still cannot reach another branch.
        const { organizationId, ...updates } = req.body;

        const filter = oneBranchFilter(req, req.params.id);
        if (!filter) return res.status(403).json({ success: false, message: 'Not authorized for this branch.' });

        const branch = await Branch.findOneAndUpdate(
            filter,
            updates,
            { new: true, runValidators: true }
        );
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

        await logAction(req.user?._id, 'Branch Updated', 'Organization', {
            branchId: String(branch._id), fields: Object.keys(updates),
        }, req);

        res.status(200).json({ success: true, data: branch });
    } catch (error) {
        next(error);
    }
};

// @desc    Deactivate a branch
// @route   DELETE /api/branches/:id
// @access  Private (owner)
exports.deleteBranch = async (req, res, next) => {
    try {
        const filter = oneBranchFilter(req, req.params.id);
        if (!filter) return res.status(403).json({ success: false, message: 'Not authorized for this branch.' });

        const branch = await Branch.findOne(filter);
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

        // A branch is never hard-deleted: attendance, leave and payroll rows carry
        // its id as a historical snapshot, and removing the document would leave
        // every one of them pointing at nothing. Refusing while it is still
        // populated also stops an organization from stranding its own people.
        const [staff, departments] = await Promise.all([
            User.countDocuments({ branchId: branch._id, isActive: true }),
            Department.countDocuments({ branchId: branch._id, status: 'active' }),
        ]);

        if (staff || departments) {
            return res.status(409).json({
                success: false,
                message: `Cannot deactivate: ${staff} active employee(s) and ${departments} active department(s) are still posted here. Move them first.`,
            });
        }

        if (branch.isDefault) {
            return res.status(409).json({
                success: false,
                message: 'Cannot deactivate the default branch. Make another branch the default first.',
            });
        }

        branch.isActive = false;
        await branch.save();

        await logAction(req.user?._id, 'Branch Deactivated', 'Organization', {
            branchId: String(branch._id), name: branch.name,
        }, req);

        res.status(200).json({ success: true, message: 'Branch deactivated', data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Who and what sits in this branch — the scope a branch actually carries
// @route   GET /api/branches/:id/scope
// @access  Private
exports.getBranchScope = async (req, res, next) => {
    try {
        if (!isSuperAdmin(req) && !canAccessBranch(req, req.params.id)) {
            return res.status(403).json({ success: false, message: 'Not authorized for this branch.' });
        }

        const branch = await Branch.findOne({ _id: req.params.id, ...scopeFilter(req) });
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

        const [departments, headcount] = await Promise.all([
            Department.find({ branchId: branch._id, status: 'active' }).select('name managerId').sort({ name: 1 }),
            User.countDocuments({ branchId: branch._id, isActive: true }),
        ]);

        res.status(200).json({
            success: true,
            data: { branch: { _id: branch._id, name: branch.name, state: branch.state }, departments, headcount },
        });
    } catch (error) {
        next(error);
    }
};
