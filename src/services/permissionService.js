const Permission = require('../models/Permission');
const PermissionConfig = require('../models/PermissionConfig');

/**
 * Get current month's permission quota usage for an employee.
 */
const getMonthlyUsage = async (employeeId, monthYear) => {
    const permissions = await Permission.find({
        employee: employeeId,
        monthYear,
        status: 'Approved'
    });

    const totalMinutes = permissions.reduce((acc, p) => acc + p.durationMinutes, 0);
    const totalCount = permissions.length;

    return { totalMinutes, totalCount };
};

/**
 * Validate a permission request against organization configuration.
 */
const validatePermission = async (employeeId, organizationId, requestData) => {
    const { fromTime, toTime, requestedDate } = requestData;
    
    // 1. Get effective config
    const config = await PermissionConfig.findOne({
        organizationId,
        effectiveFrom: { $lte: requestedDate },
        isActive: true,
        isDeleted: false
    }).sort({ effectiveFrom: -1 });

    if (!config) throw new Error("Permission policy not configured for this organization.");

    // 2. Calculate duration
    const [startH, startM] = fromTime.split(':').map(Number);
    const [endH, endM] = toTime.split(':').map(Number);
    
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    if (durationMinutes < config.minPermissionDurationMins) {
        throw new Error(`Minimum permission duration is ${config.minPermissionDurationMins} minutes.`);
    }
    if (durationMinutes > config.maxPermissionDurationMins) {
        throw new Error(`Maximum permission duration is ${config.maxPermissionDurationMins} minutes.`);
    }

    // 3. Check monthly quota
    const monthYear = requestedDate.toISOString().slice(0, 7); // YYYY-MM
    const usage = await getMonthlyUsage(employeeId, monthYear);

    if (usage.totalCount >= config.monthlyPermissionMaxTimes) {
        throw new Error(`Monthly permission count limit reached (${config.monthlyPermissionMaxTimes}).`);
    }

    if ((usage.totalMinutes + durationMinutes) > (config.monthlyPermissionHours * 60)) {
        throw new Error(`Monthly permission hours limit reached (${config.monthlyPermissionHours} hours). Remaining: ${(config.monthlyPermissionHours * 60) - usage.totalMinutes} minutes.`);
    }

    return { durationMinutes, monthYear, config };
};

module.exports = {
    getMonthlyUsage,
    validatePermission
};
