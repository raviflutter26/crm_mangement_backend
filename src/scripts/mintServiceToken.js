/**
 * Mint a long-lived access token for one user.
 *
 * Intended for service-to-service callers (integrations, cron jobs, a mobile
 * build that cannot re-login) — NOT for people. A human's token should keep the
 * short `JWT_EXPIRES_IN` default so a stolen laptop stops working in a week.
 *
 * Usage:
 *   node src/scripts/mintServiceToken.js --email=svc-integration@example.com
 *   node src/scripts/mintServiceToken.js --email=... --expires=36500d
 *
 * Run it with the SAME MONGODB_URI and JWT_SECRET as the target environment:
 * a token signed with the local secret is rejected by production, and the user
 * id it carries must exist in that environment's database.
 *
 *   MONGODB_URI=<prod uri> JWT_SECRET=<prod secret> node src/scripts/mintServiceToken.js --email=...
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const arg = (name, fallback) => {
    const hit = process.argv.find(a => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
};

const main = async () => {
    const email = arg('email');
    const expiresIn = arg('expires', '36500d'); // ~100 years

    if (!email) {
        console.error('Missing --email=<user email>. Pass the account the token should act as.');
        process.exit(1);
    }

    await mongoose.connect(config.mongodbUri);

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
        console.error(`No user with email ${email} in this database.`);
        console.error(`  Connected to: ${mongoose.connection.name}`);
        console.error('  A token for a user that does not exist here is rejected at every request.');
        process.exit(1);
    }
    if (!user.isActive) {
        console.error(`User ${email} is inactive — every request with this token would 401.`);
        process.exit(1);
    }

    // Deliberately no `jti`. Session-based revocation in middleware/auth.js keys
    // off a Session row, and a row that must outlive the process is a row someone
    // eventually prunes. This token is revoked by deactivating its user instead,
    // which is the check that runs on every request regardless.
    const token = jwt.sign({ id: user._id }, config.jwt.secret, { expiresIn });
    const { exp } = jwt.decode(token);

    console.log(`\nUser:    ${user.email} (role: ${user.role})`);
    console.log(`Expires: ${new Date(exp * 1000).toISOString()}`);
    console.log(`\n${token}\n`);
    console.log('Send it as:  Authorization: Bearer <token>');
    console.log(`To revoke:   set isActive=false on ${user.email} (takes effect immediately).`);

    if (String(user.role).toLowerCase() === 'superadmin') {
        console.warn('\n⚠️  This is a superadmin token — it bypasses every role check in authorize().');
        console.warn('   Prefer a dedicated user with the narrowest role that does the job.');
    }

    await mongoose.disconnect();
};

main().catch(async (err) => {
    console.error(err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
