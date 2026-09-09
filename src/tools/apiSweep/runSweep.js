/**
 * Logs in as each seeded QA role and reads every endpoint in the manifest.
 *
 * Two rules this tool will not bend:
 *   1. GET only. A sweep that writes would create records in whatever
 *      environment it was pointed at, which is how a "read-only check"
 *      becomes an incident.
 *   2. Credentials come from the environment, never from a caller-supplied
 *      form. A panel that accepts an arbitrary email and password is a
 *      credential-handling problem and an escalation path.
 */
const axios = require('axios');
const { ENDPOINTS, ALL_ROLES } = require('./manifest');
const { classify, isFailure } = require('./classify');

const DEFAULT_TIMEOUT_MS = 15000;

/** Read QA credentials for one role from the environment. */
function credentialsFor(role) {
    const email = process.env[`QA_${role.toUpperCase()}_EMAIL`];
    const password = process.env[`QA_${role.toUpperCase()}_PASSWORD`];
    return email && password ? { email, password } : null;
}

async function login(baseUrl, { email, password }, timeout) {
    const res = await axios.post(`${baseUrl}/api/auth/login`, { email, password }, {
        timeout,
        validateStatus: () => true,
    });
    // The login response has been through two shapes in this codebase's history.
    const token = res.data?.token || res.data?.data?.token;
    if (res.status !== 200 || !token) {
        throw new Error(`login failed for ${email} (HTTP ${res.status}: ${res.data?.message || 'no token returned'})`);
    }
    return token;
}

async function probe(baseUrl, path, token, timeout) {
    try {
        const res = await axios.get(`${baseUrl}${path}`, {
            timeout,
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true,
        });
        return { status: res.status, body: res.data, error: null };
    } catch (err) {
        // A non-2xx never lands here (validateStatus), so this is a transport failure.
        return { status: null, body: null, error: err };
    }
}

/**
 * @param {object} opts
 * @param {string} opts.baseUrl        API origin, e.g. http://localhost:5001
 * @param {string[]} [opts.roles]      roles to sweep; defaults to every role with credentials
 * @param {number} [opts.timeout]
 * @param {(msg:string)=>void} [opts.onProgress]  coarse, one line per stage
 * @param {(row:object)=>void} [opts.onProbe]     fires as each endpoint lands,
 *   so a console can stream rows instead of waiting for the whole run
 * @param {(info:object)=>void} [opts.onRoleStart]
 */
async function runSweep({
    baseUrl,
    roles,
    timeout = DEFAULT_TIMEOUT_MS,
    onProgress = () => {},
    onProbe = () => {},
    onRoleStart = () => {},
}) {
    if (!baseUrl) throw new Error('baseUrl is required');

    const requested = roles && roles.length ? roles : ALL_ROLES;
    const rows = [];
    const skipped = [];
    const startedAt = new Date();

    for (const role of requested) {
        const creds = credentialsFor(role);
        if (!creds) {
            skipped.push({ role, reason: `QA_${role.toUpperCase()}_EMAIL / _PASSWORD not set` });
            continue;
        }

        onRoleStart({ role, endpointCount: ENDPOINTS.length });

        let token;
        try {
            token = await login(baseUrl, creds, timeout);
            onProgress(`signed in as ${role}`);
        } catch (err) {
            // One bad login must not abort the other roles — a partial sweep
            // still tells you something, and hiding it would not.
            skipped.push({ role, reason: err.message });
            continue;
        }

        for (const endpoint of ENDPOINTS) {
            const result = await probe(baseUrl, endpoint.path, token, timeout);
            const { verdict, rows: rowCount, detail } = classify(result);
            const expected = endpoint.expect?.[role];

            const row = {
                role,
                path: endpoint.path,
                label: endpoint.label,
                status: result.status,
                verdict,
                rows: rowCount,
                detail,
                expected: expected ?? null,
                failed: isFailure(expected, verdict),
            };
            rows.push(row);
            onProbe(row);
        }
        onProgress(`swept ${ENDPOINTS.length} endpoints as ${role}`);
    }

    return {
        baseUrl,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        endpointCount: ENDPOINTS.length,
        rolesSwept: [...new Set(rows.map((r) => r.role))],
        skipped,
        rows,
        summary: summarise(rows),
    };
}

function summarise(rows) {
    const byVerdict = {};
    for (const r of rows) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
    return {
        total: rows.length,
        byVerdict,
        failures: rows.filter((r) => r.failed).length,
        // Reported separately because these need people, not code changes.
        emptyModules: [...new Set(rows.filter((r) => r.verdict === 'EMPTY').map((r) => r.path))].length,
    };
}

module.exports = { runSweep, credentialsFor, summarise };
