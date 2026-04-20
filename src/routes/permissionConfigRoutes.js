const express = require('express');
const router = express.Router();
const { authenticate, authorize, denySuperAdmin } = require('../middleware/auth');
const PermissionConfig = require('../models/PermissionConfig');

router.use(authenticate, denySuperAdmin);

/**
 * @desc    Get current permission config for organization
 */
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId || req.user.organizationId;
        const config = await PermissionConfig.findOne({ 
            organizationId: orgId, 
            isActive: true, 
            isDeleted: false 
        }).sort({ effectiveFrom: -1 });
        
        res.status(200).json({ success: true, data: config || {} });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

/**
 * @desc    Create or update permission config
 */
router.post('/', authorize('Admin', 'HR'), async (req, res) => {
    try {
        const orgId = req.orgId || req.user.organizationId;
        const { monthlyPermissionHours, monthlyPermissionMaxTimes, minPermissionDurationMins, maxPermissionDurationMins, permissionTypes, requiresManagerApproval, carryForward } = req.body;

        // Versioning: Create a NEW config record for history
        const config = await PermissionConfig.create({
            organizationId: orgId,
            monthlyPermissionHours,
            monthlyPermissionMaxTimes,
            minPermissionDurationMins,
            maxPermissionDurationMins,
            permissionTypes,
            requiresManagerApproval,
            carryForward,
            effectiveFrom: new Date(),
            isActive: true
        });

        // Deactivate old configs for this org
        await PermissionConfig.updateMany(
            { organizationId: orgId, _id: { $ne: config._id } },
            { $set: { isActive: false } }
        );

        res.status(201).json({ success: true, data: config });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
