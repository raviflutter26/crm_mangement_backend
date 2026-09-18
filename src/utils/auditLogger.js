const AuditLog = require('../models/AuditLog');

/**
 * Log a system action to the AuditLog collection.
 *
 * The tenant is taken from `req` when one is passed. Without it every entry was
 * written with no organizationId, which left AuditLog's
 * { organizationId, createdAt } index unusable and made a tenant's own history
 * impossible to separate from anyone else's. A superadmin acting on a named
 * tenant is attributed to that tenant, not to the platform.
 *
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Description of the action (e.g., 'Employee Created')
 * @param {string} module - The module where action occurred (e.g., 'Payroll')
 * @param {object} details - Any additional metadata for the log
 * @param {object} req - Optional Express request object for tenant, IP and User Agent
 */
const organizationIdFrom = (req) => {
    if (!req) return null;
    // A superadmin has no organizationId of their own, so the tenant they named
    // on the request is the one the action belongs to.
    return req.user?.organizationId || req.query?.organizationId || req.body?.organizationId || null;
};

const logAction = async (userId, action, module, details = {}, req = null) => {
    try {
        await AuditLog.create({
            organizationId: organizationIdFrom(req),
            userId,
            action,
            module,
            details,
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
        });
    } catch (err) {
        console.error('AuditLog Error:', err);
    }
};

module.exports = { logAction, organizationIdFrom };
