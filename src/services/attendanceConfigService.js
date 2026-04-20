const AttendanceConfig = require('../models/AttendanceConfig');

/**
 * Get effective attendance configuration for an organization on a specific date.
 * Supports policy versioning by looking for the latest config with effectiveFrom <= date.
 */
const getEffectiveConfig = async (organizationId, date = new Date()) => {
    try {
        const config = await AttendanceConfig.findOne({
            organizationId,
            effectiveFrom: { $lte: date },
            isActive: true,
            isDeleted: false
        }).sort({ effectiveFrom: -1 });

        if (!config) {
            // Fallback to a global/default config or throw error
            // In a multi-tenant system, every org should have its own config created on onboarding.
            return null;
        }

        return config.toObject();
    } catch (error) {
        console.error("Error fetching effective attendance config:", error);
        throw error;
    }
};

/**
 * Calculate attendance status based on configuration thresholds.
 */
const calculateAttendanceStatus = (checkInTime, checkOutTime, totalHours, config) => {
    if (!config) return 'Present'; // Fallback

    const { 
        startTime, 
        graceMinutes, 
        minHoursForPresent, 
        halfDayHours, 
        absentThreshold,
        lateAfterGraceAction
    } = config;

    // Convert startTime "HH:mm" to the same day's Date object
    const [startHour, startMin] = startTime.split(':').map(Number);
    const shiftStart = new Date(checkInTime);
    shiftStart.setHours(startHour, startMin, 0, 0);

    const graceThreshold = new Date(shiftStart);
    graceThreshold.setMinutes(graceThreshold.getMinutes() + graceMinutes);

    const absentCutoff = new Date(graceThreshold);
    absentCutoff.setMinutes(absentCutoff.getMinutes() + absentThreshold);

    // 1. Total hours check (Priority)
    if (totalHours >= minHoursForPresent) {
        return 'Present';
    }

    if (totalHours >= halfDayHours && totalHours < minHoursForPresent) {
        return 'Half Day';
    }

    // 2. Check-in time check
    if (checkInTime > absentCutoff) {
        return 'Absent';
    }

    if (checkInTime > graceThreshold) {
        return lateAfterGraceAction; // 'Late', 'Absent', or 'HalfDay'
    }

    return 'Present';
};

module.exports = {
    getEffectiveConfig,
    calculateAttendanceStatus
};
