/**
 * Shared test harness: a throwaway database plus user/token factories.
 *
 * Lives outside test/ because Node's runner executes every .js file under a
 * directory named `test`, and this is a helper, not a test.
 *
 * The env assignments below must happen BEFORE anything requires src/config,
 * which throws on a missing JWT_SECRET or MONGODB_URI. dotenv does not
 * overwrite variables that are already set, so setting them here also keeps
 * the real .env out — importantly, a test run can never reach the production
 * Atlas cluster it names.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-in-any-real-environment';
// Present only so src/config does not throw; nothing connects to it.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused-placeholder';

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let memoryServer;

/**
 * Connect to a throwaway database.
 *
 * Uses mongodb-memory-server: a private mongod started per run and discarded
 * after, so the suite is self-contained — it neither needs a local MongoDB
 * running nor can it touch one.
 *
 * Set MONGO_TEST_URI to point at a real server instead; the guard below still
 * refuses any database whose name does not look like a test database.
 */
async function startDb() {
    if (process.env.MONGO_TEST_URI) {
        await mongoose.connect(process.env.MONGO_TEST_URI);
    } else {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        await mongoose.connect(memoryServer.getUri());
    }

    const name = mongoose.connection.name || '';
    if (!/test/i.test(name)) {
        throw new Error(`Refusing to run tests against database "${name}" — it is not a test database.`);
    }
}

async function stopDb() {
    // Drop rather than merely disconnect, so a run leaves nothing behind.
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
    await closeBackgroundHandles();
}

/**
 * Wipe every collection between tests, so each starts from a known state and
 * cannot depend on rows another test happened to leave behind.
 */
async function clearDb() {
    const { collections } = mongoose.connection;
    for (const name of Object.keys(collections)) {
        await collections[name].deleteMany({});
    }
}

/**
 * src/services/emailService can open a Redis socket on first use. Close it
 * only if this process actually did — requiring the module here to tidy up
 * would itself open what we are trying to close.
 */
async function closeBackgroundHandles() {
    let resolved;
    try {
        resolved = require.resolve('../src/services/emailService');
    } catch {
        return;
    }
    if (!require.cache[resolved]) return; // never imported — nothing is open
    await require.cache[resolved].exports.closeEmail();
}

const User = require('../src/models/User');

/** Create a real User row, since authenticate() looks the token's subject up. */
async function makeUser({ role = 'admin', organizationId = null, isActive = true } = {}) {
    return User.create({
        firstName: 'Test',
        lastName: role,
        email: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
        password: 'hashed-not-used-in-these-tests',
        role,
        organizationId,
        isActive,
    });
}

/** A Bearer token for that user. No jti, so the Session revocation check is skipped. */
function tokenFor(user) {
    return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/** A user plus a ready-to-use Authorization header for supertest. */
async function authFor(opts) {
    const user = await makeUser(opts);
    return { user, header: `Bearer ${tokenFor(user)}` };
}

module.exports = { startDb, stopDb, clearDb, makeUser, tokenFor, authFor, closeBackgroundHandles };
