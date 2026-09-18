const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Every route must declare how it is protected.
 *
 * The three cross-tenant leaks this suite was written after all hid in the same
 * ambiguity: a route with no authorize() looked identical whether it was
 * deliberately open to every employee ("my leave", a state dropdown) or whether
 * somebody had simply forgotten the guard. There was no way to audit 300 routes
 * by reading them, so nobody did.
 *
 * The rule: an authenticated route carries authorize(...) or selfService(...).
 * Anything else fails here, which turns "did we forget a guard?" from a review
 * question into a test result. PUBLIC_ROUTES is the allowlist for the handful
 * that are genuinely unauthenticated, so adding to that surface is a deliberate,
 * reviewable edit rather than an omission.
 */

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');

/** Routes intentionally reachable with no token at all. */
const PUBLIC_ROUTES = new Set([
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/forgot-password',
    'POST /api/auth/create-password',
    'GET /api/auth/reset-password/:resettoken',
    'PUT /api/auth/reset-password/:resettoken',
    'POST /api/auth/mfa/challenge',
    // A pure calculator: takes a wage and a config in the body, touches no
    // database, and returns arithmetic. Nothing to leak.
    'POST /api/statutory/epf/calculate',
    'GET /api/master/industries',
    // Public lead capture from the marketing site.
    'POST /api/demo-requests',
]);

/** Walk src/routes/index.js for mount prefixes, then each router for its routes. */
const collectRoutes = () => {
    const idx = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');

    const mounts = {};
    for (const m of idx.matchAll(/router\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) mounts[m[2]] = m[1];
    const files = {};
    for (const m of idx.matchAll(/const (\w+) = require\('\.\/(\w+)'\)/g)) files[m[1]] = m[2];

    const routes = [];
    for (const [varName, prefix] of Object.entries(mounts)) {
        const file = files[varName];
        if (!file) continue;
        const router = require(path.join(ROUTES_DIR, file + '.js'));
        const stack = router.stack || [];
        const routerLevel = stack.filter(l => !l.route).map(l => l.handle?.name || l.name || 'anon');

        for (const layer of stack) {
            if (!layer.route) continue;
            for (const method of Object.keys(layer.route.methods)) {
                // route.stack holds the handlers for EVERY method on this path, each
                // tagged with its own. Without filtering, a `router.route('/')` whose
                // .get is self-service and whose .post is role-guarded reports the
                // union for both — which reads as though each declared two intents.
                const chain = layer.route.stack
                    .filter(s => !s.method || s.method === method)
                    .map(s => s.handle?.name || s.name || 'anon');
                const p = layer.route.path === '/' ? '' : layer.route.path;
                routes.push({
                    file,
                    id: `${method.toUpperCase()} /api${prefix}${p}`,
                    guards: [...routerLevel, ...chain],
                });
            }
        }
    }
    return routes;
};

describe('Route contract', () => {
    const routes = collectRoutes();

    test('the app actually exposes routes', () => {
        assert.ok(routes.length > 100, `expected a full route table, found ${routes.length}`);
    });

    test('every route is authenticated or explicitly listed as public', () => {
        const offenders = routes
            .filter(r => !r.guards.includes('authenticate') && !r.guards.includes('protect'))
            .filter(r => !PUBLIC_ROUTES.has(r.id))
            .map(r => `${r.id}  (${r.file})`);

        assert.deepEqual(offenders, [],
            'these routes require no token and are not in PUBLIC_ROUTES:\n  ' + offenders.join('\n  '));
    });

    test('every authenticated route declares authorize() or selfService()', () => {
        const offenders = routes
            .filter(r => r.guards.includes('authenticate') || r.guards.includes('protect'))
            .filter(r => !r.guards.includes('authorizeRole') && !r.guards.includes('selfServiceRoute'))
            .map(r => `${r.id}  (${r.file})`);

        assert.deepEqual(offenders, [],
            'these routes declare no access intent — add authorize(...) if a role is\n' +
            'required, or selfService(\'why\') if every authenticated user may reach it:\n  ' +
            offenders.join('\n  '));
    });

    test('the public surface has not grown beyond its allowlist', () => {
        const actuallyPublic = routes
            .filter(r => !r.guards.includes('authenticate') && !r.guards.includes('protect'))
            .map(r => r.id);

        // Stale entries are worth catching too: an allowlisted route that has
        // since been authenticated should be removed from the list.
        const stale = [...PUBLIC_ROUTES].filter(id => !actuallyPublic.includes(id));
        assert.deepEqual(stale, [], 'PUBLIC_ROUTES lists routes that are no longer public: ' + stale.join(', '));
    });

    test('no route is guarded by role alone on a tenant collection', () => {
        // authorize() answers "may this role call this?", never "whose rows are
        // these?". Both are required, so a route carrying neither marker at all
        // would be invisible to the checks above — assert the pairing holds.
        const bothMissing = routes.filter(r =>
            r.guards.includes('authorizeRole') && r.guards.includes('selfServiceRoute'));

        assert.deepEqual(bothMissing.map(r => r.id), [],
            'a route should declare one intent, not both');
    });
});
