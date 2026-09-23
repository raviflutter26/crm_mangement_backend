# Backend tests

```bash
npm test          # run everything
npm run test:watch
node --test test/revenue.api.test.js   # one file
```

No test framework is installed — this uses Node's built-in runner
(`node:test` + `node:assert/strict`).

## Layout

| Path | What it holds |
|---|---|
| `test/*.test.js` | The tests. Everything under `test/` is executed by the runner, so **only test files belong here.** |
| `test-utils/testEnv.js` | Shared harness: throwaway database, user + token factories. Lives outside `test/` so the runner does not execute it as a test. |

## Two kinds of test

**Unit** — a pure function, no database. Fast, and the default choice.
See `invoice.test.js`. Where logic is buried in a Mongoose hook or an Express
handler, extract it into a pure function and test that (`computeTotals`,
`deriveStatus`), rather than reaching for a database.

**API / integration** — a real HTTP request through the real Express app via
supertest, against a real (throwaway) MongoDB. See `revenue.api.test.js`.
Use these for anything unit tests structurally cannot see: route mounting,
auth, role checks, and tenant isolation.

## Writing an API test

```js
// Must be required BEFORE ../src/app — it sets NODE_ENV, JWT_SECRET, MONGODB_URI.
const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const app = require('../src/app');

before(async () => { await startDb(); });
after(async () => { await stopDb(); });
beforeEach(async () => {
    await clearDb();                                   // no leakage between tests
    admin = await authFor({ role: 'admin', organizationId: ORG_A });
});

const res = await request(app).get('/api/revenue/summary')
    .set('Authorization', admin.header);
```

`authFor()` creates a real `User` row and returns a ready `Authorization`
header — `authenticate()` looks the token's subject up in the database, so a
bare JWT is not enough.

## Rules that keep this suite trustworthy

- **`src/app.js` builds the app; `src/server.js` starts it.** Keep them apart.
  If `app.js` ever connects to a database or listens on a port, supertest
  can no longer import it.
- **Never let a test depend on the clock.** Pass `now` in rather than calling
  `new Date()` inside the code under test, or the test's result depends on
  the day it runs.
- **Prove a new test can fail.** Break the code it covers and watch it go red.
  A test that passes either way is worse than no test.
- **Tenant isolation deserves an explicit test.** `scopeFilter` is what keeps
  one customer's data away from another; assert that org B cannot see org A's
  rows, and that a forged `organizationId` in the body is ignored.

## Environment

Tests never touch a real database. `test-utils/testEnv.js` sets `MONGODB_URI`
and `JWT_SECRET` before `src/config` loads, so the production Atlas cluster in
`.env` is unreachable from a test run, and starts a private in-memory MongoDB
(`mongodb-memory-server`) per run. Set `MONGO_TEST_URI` to use a real server
instead; the harness still refuses any database whose name lacks "test".

`src/services/emailService.js` opens a Redis socket and a BullMQ queue at
import time. `stopDb()` closes both — without that the runner never exits,
and `--test-force-exit` is not a fix (it truncates the TAP output and reports
a different test count on each run).

## Why `--test-concurrency=4`

Each test file starts its own `mongod` via `mongodb-memory-server`. Node's
default concurrency is the CPU count, so on an 8-core machine all 18 suites
raced to stand up 8 databases at once — and suites began failing on resource
contention rather than on anything they assert. The failures moved around
between runs and vanished when a suite was run on its own, which is the
signature to watch for.

Capping concurrency keeps the run deterministic. If you still see a suite pass
alone but fail in the full run, drop to `--test-concurrency=2` (verified green)
before looking for a logic bug.
