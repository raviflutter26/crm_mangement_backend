# API sweep

Signs in as one seeded QA account per role, reads every endpoint in the
manifest, and classifies each result so you can tell **"this module has no
data"** apart from **"this module is broken"** — which the UI cannot.

```bash
npm run sweep:seed                                  # once per environment
npm run sweep -- --base https://staging.example.com
npm run sweep -- --roles admin,hr --json report.json
```

## Why it exists

A page that renders empty looks identical to a page whose request 403'd, 404'd
or never reached the server. An audit of 67 destinations done by hand concluded
four modules were unbuilt; they were fully built and working, and the requests
were failing silently. This tool answers that question in about two seconds
per role.

## What each verdict means

| Verdict | Cause | Whose job |
|---|---|---|
| `OK` | 200 with rows | — |
| `EMPTY` | 200, no rows | Ops — seed data. **Not a defect.** |
| `FORBIDDEN` | 403 | Backend — role guard, if unexpected |
| `NOT_MOUNTED` | 404 | Backend — route never mounted, *or* the manifest names a path that does not exist |
| `UNAUTHORIZED` | 401 | Env — QA credentials wrong or expired |
| `SERVER_ERROR` | 5xx | Backend — bug |
| `BAD_REQUEST` | other 4xx | Backend — contract |
| `UNREACHABLE` | no response | Env — API down, or the devtunnel expired |

`EMPTY` never fails a run. Treating an empty tenant as a defect is the exact
confusion this tool exists to remove.

## Two rules it will not bend

**GET only.** A sweep that wrote would create records in whatever environment
it was pointed at. Seeding is a separate script for the same reason.

**Credentials come from the environment.** There is deliberately no way to pass
an email and password in. A panel that accepts arbitrary credentials is both a
credential-handling problem and a privilege-escalation path — you pick a
*role*, never a login.

## Environment

```
QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD          # and the same for
QA_HR_*, QA_MANAGER_*, QA_EMPLOYEE_*, QA_SUPERADMIN_*
QA_ORG_SLUG                                # optional; default qa-sweep-org
SWEEP_BASE_URL                             # optional; --base overrides
```

A role with no credentials is reported as skipped, not as 61 failures.

## Guards

- `cli.js` refuses a base URL containing `prod`, `production` or `live` unless
  `--allow-prod` is passed. Even a read-only sweep authenticates as real users
  and writes `Session` rows.
- `seedQaUsers.js` refuses any database whose name lacks `staging`, `test` or
  `qa`.

## Keeping the manifest honest

`ENDPOINTS` in `manifest.js` is an explicit list, not router introspection —
Express 5 changed the internal layer shape, so a walker breaks on upgrade.
`checkDrift()` compares it against the mounts in `routes/index.js` and prints
anything uncovered, so a new module cannot go unswept unnoticed.

Currently uncovered and intentionally so: `/organization` (an alias of
`/organizations`), `/notifications` (no GET route exists), `/bank` (no list route).

## Exit codes

`0` no stated expectation violated · `1` at least one violated · `2` the sweep
could not run (prod guard, bad arguments)

## Relationship to the test suite

Different jobs. `npm test` catches code regressions before merge, against an
in-memory database. This catches environment and wiring problems in a deployed
environment: unmounted route, unseeded tenant, expired tunnel, missing env var.
Keep both.
