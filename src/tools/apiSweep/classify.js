/**
 * Turn one HTTP result into a verdict a person can act on.
 *
 * The whole point of the sweep is this classification. "Something failed" is
 * not actionable; "this route was never mounted" and "this tenant has no rows"
 * are completely different jobs for different people, and today they look
 * identical in the UI.
 *
 * Mirrors the frontend's describeError() in website/src/lib/fetchError.ts.
 * Not imported from there: different repo, TypeScript, and this runs in plain
 * CommonJS. If you change the categories, change both.
 */

const VERDICT = {
    OK: 'OK',                     // 200 with rows
    EMPTY: 'EMPTY',               // 200, no rows — not a bug
    FORBIDDEN: 'FORBIDDEN',       // 403
    NOT_MOUNTED: 'NOT_MOUNTED',   // 404 — the real "phantom module"
    UNAUTHORIZED: 'UNAUTHORIZED', // 401 — bad or expired credentials
    SERVER_ERROR: 'SERVER_ERROR', // 5xx
    BAD_REQUEST: 'BAD_REQUEST',   // 4xx other
    UNREACHABLE: 'UNREACHABLE',   // no response at all
};

const OWNER = {
    [VERDICT.OK]: '—',
    [VERDICT.EMPTY]: 'Ops — seed data',
    [VERDICT.FORBIDDEN]: 'Backend — role guard',
    [VERDICT.NOT_MOUNTED]: 'Backend — route not mounted',
    [VERDICT.UNAUTHORIZED]: 'Env — credentials',
    [VERDICT.SERVER_ERROR]: 'Backend — bug',
    [VERDICT.BAD_REQUEST]: 'Backend — contract',
    [VERDICT.UNREACHABLE]: 'Env — API down or tunnel expired',
};

/** How many rows came back, for the shapes this API actually returns. */
function countRows(body) {
    const data = body?.data;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(body)) return body.length;
    // An object payload (a summary, a dashboard) counts as present if it has keys.
    if (data && typeof data === 'object') return Object.keys(data).length > 0 ? 1 : 0;
    return data == null ? 0 : 1;
}

/**
 * @param {{status:number|null, body:any, error:Error|null}} result
 * @returns {{verdict:string, rows:number|null, detail:string}}
 */
function classify(result) {
    const { status, body, error } = result;

    if (status == null) {
        return {
            verdict: VERDICT.UNREACHABLE,
            rows: null,
            detail: error?.message || 'no response from the server',
        };
    }

    if (status === 401) {
        return { verdict: VERDICT.UNAUTHORIZED, rows: null, detail: body?.message || 'not authorized' };
    }
    if (status === 403) {
        return { verdict: VERDICT.FORBIDDEN, rows: null, detail: body?.message || 'forbidden' };
    }
    if (status === 404) {
        return { verdict: VERDICT.NOT_MOUNTED, rows: null, detail: body?.message || 'not found' };
    }
    if (status >= 500) {
        return { verdict: VERDICT.SERVER_ERROR, rows: null, detail: body?.message || `HTTP ${status}` };
    }
    if (status >= 400) {
        return { verdict: VERDICT.BAD_REQUEST, rows: null, detail: body?.message || `HTTP ${status}` };
    }

    const rows = countRows(body);
    return rows > 0
        ? { verdict: VERDICT.OK, rows, detail: '' }
        : { verdict: VERDICT.EMPTY, rows: 0, detail: 'responded, but holds no records' };
}

/**
 * Did this result violate a stated expectation?
 *
 * EMPTY never counts as a failure: an empty tenant is a data situation, not a
 * defect, and conflating the two is exactly the mistake this tool exists to
 * stop. Nothing is judged where the manifest states no expectation.
 */
function isFailure(expected, verdict) {
    if (!expected) return false;
    if (expected === 200) return verdict !== VERDICT.OK && verdict !== VERDICT.EMPTY;
    if (expected === 403) return verdict !== VERDICT.FORBIDDEN;
    return false;
}

module.exports = { classify, isFailure, countRows, VERDICT, OWNER };
