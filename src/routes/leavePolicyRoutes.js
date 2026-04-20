const express = require('express');
const router = express.Router();
const { authenticate, authorize, denySuperAdmin } = require('../middleware/auth');
const LeavePolicy = require('../models/LeavePolicy');

router.use(authenticate, denySuperAdmin);

/**
 * @desc    Get all leave policies for organization
 */
router.get('/', async (req, res) => {
    try {
        const orgId = req.orgId || req.user.organizationId;
        const policies = await LeavePolicy.find({ organizationId: orgId, isDeleted: false });
        res.status(200).json({ success: true, data: policies });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

/**
 * @desc    Create or update leave policy
 */
router.post('/', authorize('Admin', 'HR'), async (req, res) => {
    try {
        const orgId = req.orgId || req.user.organizationId;
        const { leaveType, leaveTypeLabel, daysPerYear, accrualType, accrualAmount, carryForwardDays, encashable, requiresDocument, minDaysNotice, maxConsecutiveDays, applicableAfterDays, genderSpecific, effectiveYear } = req.body;

        let policy = await LeavePolicy.findOne({ organizationId: orgId, leaveType, effectiveYear, isDeleted: false });

        if (policy) {
            Object.assign(policy, { leaveTypeLabel, daysPerYear, accrualType, accrualAmount, carryForwardDays, encashable, requiresDocument, minDaysNotice, maxConsecutiveDays, applicableAfterDays, genderSpecific });
            await policy.save();
        } else {
            policy = await LeavePolicy.create({
                organizationId: orgId,
                leaveType, leaveTypeLabel, daysPerYear, accrualType, accrualAmount, carryForwardDays, encashable, requiresDocument, minDaysNotice, maxConsecutiveDays, applicableAfterDays, genderSpecific, effectiveYear
            });
        }

        res.status(201).json({ success: true, data: policy });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

/**
 * @desc    Soft delete policy
 */
router.delete('/:id', authorize('Admin', 'HR'), async (req, res) => {
    try {
        const policy = await LeavePolicy.findById(req.params.id);
        if (!policy) return res.status(404).json({ success: false, message: 'Policy not found.' });
        
        policy.isDeleted = true;
        await policy.save();
        res.status(200).json({ success: true, message: 'Policy deleted.' });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
