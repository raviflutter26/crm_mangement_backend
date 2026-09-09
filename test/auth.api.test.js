const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb, authFor, tokenFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const Session = require('../src/models/Session');

const ORG = new mongoose.Types.ObjectId();
const PASSWORD = 'Correct-Horse-Battery-1';

// The credential limiter is keyed on IP + email and allows 8 failures per
// window, so every test uses its own address to stay independent.
let n = 0;
const freshEmail = () => `auth-${Date.now()}-${n++}@test.local`;

const makeLoginUser = async (over = {}) => {
    const email = over.email || freshEmail();
    // password is hashed by User's pre-save hook.
    const user = await User.create({
        firstName: 'Login', lastName: 'User', email,
        password: PASSWORD, role: 'admin', organizationId: ORG, isActive: true, ...over,
    });
    return { user, email };
};

describe('Auth API', () => {
    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    describe('login', () => {
        test('succeeds with correct credentials and returns a token', async () => {
            const { email } = await makeLoginUser();
            const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.token || res.body.data?.token, 'a token should be returned');
        });

        test('rejects a wrong password', async () => {
            const { email } = await makeLoginUser();
            const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
            assert.equal(res.status, 401);
            assert.equal(res.body.success, false);
        });

        test('rejects an unknown email with the same status as a wrong password', async () => {
            // Identical responses matter: a different status would let an
            // attacker enumerate which addresses have accounts.
            const res = await request(app).post('/api/auth/login')
                .send({ email: freshEmail(), password: PASSWORD });
            assert.equal(res.status, 401);
        });

        test('rejects a missing password', async () => {
            const { email } = await makeLoginUser();
            const res = await request(app).post('/api/auth/login').send({ email });
            assert.equal(res.status, 400);
        });

        test('rejects an empty body without crashing', async () => {
            const res = await request(app).post('/api/auth/login').send();
            assert.equal(res.status, 400);
        });

        test('rate-limits repeated failures for one email', async () => {
            const { email } = await makeLoginUser();
            let limited = false;
            // The budget is 8 failures; the 9th must be refused.
            for (let i = 0; i < 10; i++) {
                const res = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
                if (res.status === 429) { limited = true; break; }
            }
            assert.ok(limited, 'repeated failed logins must eventually be rate-limited');
        });
    });

    describe('token handling on /api/auth/me', () => {
        test('returns the caller with a valid token', async () => {
            const { user } = await makeLoginUser();
            const res = await request(app).get('/api/auth/me')
                .set('Authorization', `Bearer ${tokenFor(user)}`);
            assert.equal(res.status, 200);
        });

        test('rejects a missing token', async () => {
            assert.equal((await request(app).get('/api/auth/me')).status, 401);
        });

        test('rejects a malformed token', async () => {
            const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nonsense');
            assert.equal(res.status, 401);
        });

        test('rejects a token signed with a different secret', async () => {
            const { user } = await makeLoginUser();
            const forged = jwt.sign({ id: user._id.toString() }, 'some-other-secret', { expiresIn: '1h' });
            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
            assert.equal(res.status, 401);
        });

        test('rejects an expired token', async () => {
            const { user } = await makeLoginUser();
            const expired = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '-1s' });
            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
            assert.equal(res.status, 401);
        });

        test('rejects a token whose user has been deactivated', async () => {
            const { user } = await makeLoginUser();
            const token = tokenFor(user);
            await User.updateOne({ _id: user._id }, { isActive: false });

            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
            assert.equal(res.status, 401, 'a deactivated user must not keep access');
        });

        test('rejects a token whose user no longer exists', async () => {
            const { user } = await makeLoginUser();
            const token = tokenFor(user);
            await User.deleteOne({ _id: user._id });

            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
            assert.equal(res.status, 401);
        });
    });

    describe('session revocation', () => {
        test('a revoked session stops being accepted', async () => {
            const { email } = await makeLoginUser();
            const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
            const token = login.body.token || login.body.data?.token;

            // Confirm it works before revoking, so a failure below means revocation.
            await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

            const { jti } = jwt.decode(token);
            await Session.updateOne({ jti }, { revoked: true });

            const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
            assert.equal(res.status, 401, 'a revoked session must be rejected');
        });

        test('sessions can be listed by their owner', async () => {
            const { email } = await makeLoginUser();
            const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
            const token = login.body.token || login.body.data?.token;

            const res = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${token}`);
            assert.equal(res.status, 200);
        });
    });

    describe('role-guarded auth routes', () => {
        test('sso-config is refused to a non-admin', async () => {
            const emp = await authFor({ role: 'employee', organizationId: ORG });
            const res = await request(app).get('/api/auth/sso-config').set('Authorization', emp.header);
            assert.equal(res.status, 403);
        });

        test('sso-config is allowed for an admin', async () => {
            const admin = await authFor({ role: 'admin', organizationId: ORG });
            const res = await request(app).get('/api/auth/sso-config').set('Authorization', admin.header);
            assert.equal(res.status, 200);
        });

        test('listing users is refused to a non-admin', async () => {
            const emp = await authFor({ role: 'employee', organizationId: ORG });
            const res = await request(app).get('/api/auth/users').set('Authorization', emp.header);
            assert.equal(res.status, 403);
        });
    });
});
