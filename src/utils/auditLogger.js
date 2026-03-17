const AuditLog = require('../models/AuditLog');

/**
 * Log a system action to the AuditLog collection
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Description of the action (e.g., 'Employee Created')
 * @param {string} module - The module where action occurred (e.g., 'Payroll')
 * @param {object} details - Any additional metadata for the log
 * @param {object} req - Optional Express request object for IP and User Agent
 */
const logAction = async (userId, action, module, details = {}, req = null) => {
    try {
        await AuditLog.create({
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

module.exports = { logAction };
