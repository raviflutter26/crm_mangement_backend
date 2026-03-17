const ModulePermission = require('../models/ModulePermission');

/**
 * @desc    Get all module permissions
 * @route   GET /api/role-permissions
 */
exports.getModulePermissions = async (req, res, next) => {
    try {
        const permissions = await ModulePermission.find();
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

        for (const p of permissions) {
            await ModulePermission.findOneAndUpdate(
                { module: p.module },
                { roles: p.roles },
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
