/**
 * Tenant scoping helpers.
 *
 * The organization a request is allowed to touch is always derived from the
 * authenticated user (req.user), never from the request payload. The browser
 * can edit anything it sends, so a client-supplied organizationId is untrusted
 * input — see the interceptor in the website's lib/axios.ts, which attaches one
 * for convenience only.
 *
 * Superadmins are the single exception: they operate across tenants and may
 * target one explicitly via ?organizationId.
 */

const isSuperAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'superadmin';

/**
 * A filter that provably matches no document, used to fail closed.
 *
 * Returning { organizationId: undefined } instead would be unsafe: an undefined
 * value is dropped or coerced to null depending on driver settings, so the
 * filter could widen to every tenant's rows. $in: [] can never match.
 */
const MATCH_NOTHING = Object.freeze({ _id: { $in: [] } });

/**
 * Filter to merge into every read. Returns {} for a superadmin with no target
 * org, which intentionally reads across all tenants. For a tenant user with no
 * organization (User.organizationId defaults to null) it fails closed rather
 * than widening to a match-all filter.
 */
const scopeFilter = (req) => {
    if (isSuperAdmin(req)) {
        return req.query?.organizationId ? { organizationId: req.query.organizationId } : {};
    }

    const orgId = req.user?.organizationId;
    if (!orgId) return { ...MATCH_NOTHING };

    return { organizationId: orgId };
};

/** The organization new documents belong to, or null if it can't be determined. */
const orgIdFor = (req) => {
    if (isSuperAdmin(req)) {
        return req.body?.organizationId || req.query?.organizationId || null;
    }
    return req.user?.organizationId || null;
};

/**
 * Strip any client-supplied tenant key from a write payload, then stamp the
 * trusted one. Use this for every create/update body.
 */
const withOrg = (req, payload = {}) => {
    const clean = { ...payload };
    delete clean.organizationId;
    delete clean.companyId; // legacy tenant key on StatutoryConfig
    const orgId = orgIdFor(req);
    if (orgId) clean.organizationId = orgId;
    return clean;
};

/**
 * Guard for handlers that cannot do anything sensible without a tenant.
 * Sends a 400 and returns null when the context is missing, so callers can
 * `const orgId = requireOrg(req, res); if (!orgId) return;`
 */
const requireOrg = (req, res) => {
    const orgId = orgIdFor(req);
    if (!orgId) {
        res.status(400).json({ success: false, message: 'Organization context is missing.' });
        return null;
    }
    return orgId;
};

/**
 * Guard for handlers that act on an organization named in the URL.
 * Superadmins may target any organization; everyone else is confined to their own.
 * Returns the id to act on, or null after sending a 403.
 */
const requireOwnOrg = (req, res, targetOrgId) => {
    if (isSuperAdmin(req)) return String(targetOrgId);

    const own = String(req.user?.organizationId || '');
    if (!own || String(targetOrgId) !== own) {
        res.status(403).json({ success: false, message: 'Not authorized for this organization.' });
        return null;
    }
    return own;
};

module.exports = { isSuperAdmin, scopeFilter, orgIdFor, withOrg, requireOrg, requireOwnOrg, MATCH_NOTHING };
