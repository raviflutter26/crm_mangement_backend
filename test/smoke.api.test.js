const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb } = require('../test-utils/testEnv');
const request = require('supertest');
const app = require('../src/app');

describe('API smoke', () => {
    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    test('health check responds without authentication', async () => {
        const res = await request(app).get('/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    test('an unknown route 404s with the standard envelope', async () => {
        const res = await request(app).get('/api/definitely-not-a-route');
        assert.equal(res.status, 404);
        assert.equal(res.body.success, false);
    });
});
