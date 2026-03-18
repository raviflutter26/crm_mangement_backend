const AttendanceConfig = require('../models/AttendanceConfig');

let cachedConfig = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute in-memory cache

/**
 * Get Global Attendance & Permission Configuration
 * Provides singleton logic and in-memory caching
 */
const getAttendanceConfig = async () => {
    const now = Date.now();
    
    // Return cached if still valid
    if (cachedConfig && (now - lastFetchTime < CACHE_TTL)) {
        return cachedConfig;
    }

    try {
        let config = await AttendanceConfig.findOne({ isActive: true });
        
        if (!config) {
            // Create default singleton if none exists
            config = await AttendanceConfig.create({});
        }

        cachedConfig = config.toObject();
        lastFetchTime = now;
        
        return cachedConfig;
    } catch (error) {
        console.error("Error fetching attendance config:", error);
        // Fallback to defaults if DB fails
        return {
            startTime: "09:00",
            endTime: "18:00",
            workingHours: 9,
            graceMinutes: 30,
            latePolicyEnabled: true,
            maxLateDaysPerMonth: 3,
            lateMarkType: "half_day",
            permissionEnabled: true,
            maxPermissionCount: 4,
            maxPermissionHours: 4
        };
    }
};

/**
 * Force clear cache (call after updates)
 */
const clearCache = () => {
    cachedConfig = null;
    lastFetchTime = 0;
};

module.exports = {
    getAttendanceConfig,
    clearCache
};
