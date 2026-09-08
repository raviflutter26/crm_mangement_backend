const AttendanceConfig = require('../models/AttendanceConfig');

// Cache is keyed by organization. A single shared entry would apply one tenant's
// grace period and late policy to every other tenant's attendance — and attendance
// feeds payroll, so that error would reach payslips.
const cache = new Map(); // organizationId -> { config, fetchedAt }
const CACHE_TTL = 60 * 1000; // 1 minute in-memory cache

const DEFAULTS = {
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

/**
 * Get attendance & permission configuration for one organization.
 * Prefer attendanceConfigService.getEffectiveConfig() when you need
 * date-effective policy versioning.
 *
 * @param {string} organizationId - required; there is no global config.
 */
const getAttendanceConfig = async (organizationId) => {
    if (!organizationId) {
        throw new Error('getAttendanceConfig requires an organizationId.');
    }

    const key = String(organizationId);
    const now = Date.now();
    const hit = cache.get(key);

    if (hit && (now - hit.fetchedAt < CACHE_TTL)) {
        return hit.config;
    }

    try {
        let config = await AttendanceConfig.findOne({ isActive: true, organizationId });

        if (!config) {
            // Create this organization's default on first use
            config = await AttendanceConfig.create({ organizationId });
        }

        const plain = config.toObject();
        cache.set(key, { config: plain, fetchedAt: now });
        return plain;
    } catch (error) {
        console.error(`Error fetching attendance config for org ${key}:`, error);
        // Fallback to defaults if DB fails — not cached, so the next call retries
        return { ...DEFAULTS };
    }
};

/**
 * Force clear cache (call after updates).
 * @param {string} [organizationId] - clears one organization; omit to clear all.
 */
const clearCache = (organizationId) => {
    if (organizationId) {
        cache.delete(String(organizationId));
    } else {
        cache.clear();
    }
};

module.exports = {
    getAttendanceConfig,
    clearCache
};
