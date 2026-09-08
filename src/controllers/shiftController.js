const Shift = require('../models/Shift');
const { scopeFilter } = require('../utils/tenancy');

/**
 * @desc    Create a new shift
 * @route   POST /api/shifts
 */
exports.createShift = async (req, res, next) => {
    try {
        const { organizationId, name, startTime, endTime, workingHours, graceMinutes, maxLatePerMonth, workingDays, isNightShift } = req.body;

        if (!organizationId || !name || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const shift = await Shift.create({
            organizationId,
            name,
            startTime,
            endTime,
            workingHours,
            graceMinutes,
            maxLatePerMonth,
            workingDays,
            isNightShift
        });

        res.status(201).json({
            success: true,
            data: shift
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get shifts for an organization
 * @route   GET /api/shifts?organizationId=XYZ
 */
exports.getShifts = async (req, res, next) => {
    try {
        const { organizationId } = req.query;
        const filter = organizationId ? { organizationId } : {};
        
        const shifts = await Shift.find(filter).populate('organizationId', 'name');
        res.status(200).json({
            success: true,
            data: shifts
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update shift
 * @route   PUT /api/shifts/:id
 */
exports.updateShift = async (req, res, next) => {
    try {
        const shift = await Shift.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!shift) {
            return res.status(404).json({ success: false, message: 'Shift not found' });
        }

        res.status(200).json({
            success: true,
            data: shift
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete shift
 * @route   DELETE /api/shifts/:id
 */
exports.deleteShift = async (req, res, next) => {
    try {
        const shift = await Shift.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!shift) {
             return res.status(404).json({ success: false, message: 'Shift not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Shift deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
