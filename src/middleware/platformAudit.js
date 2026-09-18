const AuditLog = require('../models/AuditLog');
const { isSuperAdmin } = require('../utils/tenancy');

/**
 * Records when the platform superadmin reaches into a customer's data.
 *
 * A superadmin bypasses every role check (see authorize) and every tenant
 * filter (see scopeFilter), which is what makes the account useful for support
 * and what makes it the one account a customer cannot hold to account. For a
 * SaaS handling payroll, salary and bank details, "who looked at this, and
 * when" has to be answerable. This leaves that trail.
 *
 * It records access; it does not prevent it. Blocking support access would be a
 * product decision, and a superadmin who can deploy could lift the block anyway
 * — an append-only trail is the honest control here.
 */

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The platform's own console: listing customers, its analytics, its audit log,
 * signing in. Auditing a superadmin for reading their own dashboard would bury
 * the entries that matter in noise, so these are skipped on reads only — a
 * write to any of them still lands.
 */
const PLATFORM_READ_PREFIXES = [
    '/api/superadmin',
    '/api/auth',
    '/api/organizations',
    '/api/health',
    '/api/system-health',
];

const isPlatformConsoleRead = (req) => {
    if (!READ_METHODS.has(req.method)) return false;
    const url = req.originalUrl || req.url || '';
    return PLATFORM_READ_PREFIXES.some(p => url.startsWith(p));
};

/**
 * Called from authenticate as a side effect, never awaited: an audit write must
 * not add latency to, or be able to fail, the request it describes. The same
 * fire-and-forget shape as the Session lastActiveAt touch beside it.
 */
const recordPlatformAccess = async (req) => {
    if (!isSuperAdmin(req)) return;
    if (isPlatformConsoleRead(req)) return;

    // Which tenant was reached. Absent means the request was not narrowed to one,
    // so it read across every tenant — broader, not narrower, and worth flagging.
    const targetOrg = req.query?.organizationId || req.body?.organizationId || null;

    await AuditLog.create({
        organizationId: targetOrg || null,
        userId: req.user?._id,
        action: `${req.method} ${req.originalUrl || req.url}`,
        module: 'Platform Access',
        details: {
            reach: targetOrg ? 'single-tenant' : 'all-tenants',
            write: !READ_METHODS.has(req.method),
            superadminEmail: req.user?.email || null,
        },
        ipAddress: req.ip || null,
        userAgent: req.headers?.['user-agent'] || null,
    });
};

module.exports = { recordPlatformAccess, PLATFORM_READ_PREFIXES };
