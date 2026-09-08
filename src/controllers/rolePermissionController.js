const ModulePermission = require('../models/ModulePermission');
const { scopeFilter, requireOrg } = require('../utils/tenancy');

/**
 * @desc    Get all module permissions
 * @route   GET /api/role-permissions
 */
exports.getModulePermissions = async (req, res, next) => {
    try {
        const permissions = await ModulePermission.find(scopeFilter(req));
        res.status(200).json({
            success: true,
            data: permissions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update permissions for multiple modules
 * @route   PUT /api/role-permissions
 */
exports.updateAllPermissions = async (req, res, next) => {
    try {
        const { permissions } = req.body; // Array of { module, roles }
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: 'permissions must be an array.' });
        }

        const orgId = requireOrg(req, res);
        if (!orgId) return;

        for (const p of permissions) {
            await ModulePermission.findOneAndUpdate(
                { module: p.module, organizationId: orgId },
                { roles: p.roles, organizationId: orgId },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Permissions updated successfully'
        });
    } catch (error) {
        next(error);
    }
};
