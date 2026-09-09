#!/usr/bin/env node
/**
 * CLI for the API sweep.
 *
 *   node src/tools/apiSweep/cli.js --base http://localhost:5001
 *   node src/tools/apiSweep/cli.js --roles admin,hr --json report.json
 *
 * Refuses to run against anything that looks like production unless
 * --allow-prod is passed, because even a read-only sweep authenticates as
 * real users and writes login/session rows.
 */
const fs = require('fs');
const { runSweep } = require('./runSweep');
const { OWNER } = require('./classify');
const { checkDrift } = require('./manifest');

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const PROD_HINTS = [/\bprod\b/i, /\bproduction\b/i, /\blive\b/i];

const ICON = {
    OK: '  ok  ', EMPTY: ' empty', FORBIDDEN: '  403 ', NOT_MOUNTED: '  404 ',
    UNAUTHORIZED: '  401 ', SERVER_ERROR: '  500 ', BAD_REQUEST: '  4xx ', UNREACHABLE: ' down ',
};

(async () => {
    const baseUrl = (flag('base') || process.env.SWEEP_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

    if (PROD_HINTS.some((re) => re.test(baseUrl)) && !has('allow-prod')) {
        console.error(`Refusing to sweep "${baseUrl}" — it looks like production.`);
        console.error('The sweep logs in as real users and creates session rows. Pass --allow-prod if you are sure.');
        process.exit(2);
    }

    const roles = flag('roles') ? flag('roles').split(',').map((r) => r.trim()).filter(Boolean) : null;

    console.log(`\nAPI sweep → ${baseUrl}`);
    console.log('GET requests only. Credentials read from QA_<ROLE>_EMAIL / _PASSWORD.\n');

    const report = await runSweep({
        baseUrl,
        roles,
        onProgress: (m) => console.log(`  · ${m}`),
    });

    // Per-role table, failures and problems first so the useful rows are not
    // buried under dozens of working ones.
    const rank = { SERVER_ERROR: 0, NOT_MOUNTED: 1, UNREACHABLE: 2, UNAUTHORIZED: 3, BAD_REQUEST: 4, FORBIDDEN: 5, EMPTY: 6, OK: 7 };

    for (const role of report.rolesSwept) {
        const rows = report.rows.filter((r) => r.role === role)
            .sort((a, b) => (rank[a.verdict] - rank[b.verdict]) || a.path.localeCompare(b.path));

        console.log(`\n${'='.repeat(96)}\n  ${role.toUpperCase()}\n${'='.repeat(96)}`);
        console.log(`  ${'VERDICT'.padEnd(8)} ${'ROWS'.padEnd(5)} ${'ENDPOINT'.padEnd(40)} NOTE`);
        for (const r of rows) {
            const mark = r.failed ? '!' : ' ';
            const rowsText = r.rows == null ? '-' : String(r.rows);
            const note = r.failed ? `EXPECTED ${r.expected} — ${OWNER[r.verdict]}` : (r.detail || '');
            console.log(`${mark} ${ICON[r.verdict].padEnd(8)} ${rowsText.padEnd(5)} ${r.path.padEnd(40)} ${note}`);
        }
    }

    // Summary
    console.log(`\n${'='.repeat(96)}\n  SUMMARY\n${'='.repeat(96)}`);
    console.log(`  endpoints per role : ${report.endpointCount}`);
    console.log(`  roles swept        : ${report.rolesSwept.join(', ') || 'none'}`);
    console.log(`  probes             : ${report.summary.total}`);
    console.log(`  duration           : ${(report.durationMs / 1000).toFixed(1)}s`);
    console.log('');

    // The headline number: violations of a stated expectation. Printed on its
    // own line because a byVerdict breakdown alone buries it.
    const failed = report.rows.filter((r) => r.failed);
    if (failed.length === 0) {
        console.log('  no stated expectation was violated\n');
    } else {
        console.log(`  ${failed.length} FAILURE(S) — a role did not get the access the manifest states:`);
        for (const r of failed) {
            console.log(`    ${r.role.padEnd(11)} ${r.path.padEnd(40)} expected ${r.expected}, got ${r.verdict}`);
        }
        console.log('');
    }
    for (const [verdict, count] of Object.entries(report.summary.byVerdict).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${verdict.padEnd(14)} ${String(count).padStart(4)}   ${OWNER[verdict]}`);
    }

    if (report.skipped.length) {
        console.log('\n  SKIPPED ROLES');
        for (const s of report.skipped) console.log(`    ${s.role.padEnd(12)} ${s.reason}`);
    }

    const drift = checkDrift(fs.readFileSync(`${__dirname}/../../routes/index.js`, 'utf8'));
    if (drift.length) {
        console.log(`\n  MOUNTS NOT COVERED BY THE MANIFEST (invisible to this sweep)\n    ${drift.join(', ')}`);
    }

    const out = flag('json');
    if (out) {
        fs.writeFileSync(out, JSON.stringify(report, null, 2));
        console.log(`\n  report written to ${out}`);
    }

    console.log('');
    // Non-zero only for stated-expectation violations. EMPTY is a data state,
    // not a defect, so it must never fail a pipeline.
    process.exit(report.summary.failures > 0 ? 1 : 0);
})().catch((err) => {
    console.error('\nSweep aborted:', err.message);
    process.exit(2);
});
