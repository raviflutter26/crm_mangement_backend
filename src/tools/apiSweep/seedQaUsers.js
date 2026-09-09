#!/usr/bin/env node
/**
 * Create the QA accounts the sweep signs in as.
 *
 *   node src/tools/apiSweep/seedQaUsers.js
 *
 * Reads QA_<ROLE>_EMAIL / QA_<ROLE>_PASSWORD for each role and upserts a user.
 * Deliberately separate from the sweep itself: seeding writes, sweeping does
 * not, and keeping them apart means the read-only tool stays read-only.
 *
 * Refuses to run unless the database name contains "staging" or "test", so a
 * mistyped MONGODB_URI cannot plant QA logins in the production tenant.
 */
const mongoose = require('mongoose');
const config = require('../../config');
const User = require('../../models/User');
const Organization = require('../../models/Organization');

const ROLES = ['superadmin', 'admin', 'hr', 'manager', 'employee'];

async function main() {
    await mongoose.connect(config.mongodbUri);
    const dbName = mongoose.connection.name || '';

    if (!/staging|test|qa/i.test(dbName)) {
        console.error(`Refusing to seed QA users into database "${dbName}".`);
        console.error('Point MONGODB_URI at a staging/test database first.');
        await mongoose.disconnect();
        process.exit(2);
    }

    // Every role except superadmin needs a tenant to belong to.
    const orgSlug = process.env.QA_ORG_SLUG || 'qa-sweep-org';
    let org = await Organization.findOne({ slug: orgSlug });
    if (!org) {
        org = await Organization.create({
            name: 'QA Sweep Organization',
            slug: orgSlug,
            email: `${orgSlug}@qa.local`,
            industry: 'Other',
            maxEmployees: 500,
            status: 'active',
        });
        console.log(`created organization ${org.slug}`);
    }

    for (const role of ROLES) {
        const email = process.env[`QA_${role.toUpperCase()}_EMAIL`];
        const password = process.env[`QA_${role.toUpperCase()}_PASSWORD`];
        if (!email || !password) {
            console.log(`skip ${role.padEnd(11)} QA_${role.toUpperCase()}_EMAIL / _PASSWORD not set`);
            continue;
        }

        const existing = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (existing) {
            // Reset the password so a rotated env value keeps working; assigning
            // it triggers User's pre-save hash.
            existing.password = password;
            existing.isActive = true;
            existing.status = 'Active';
            await existing.save();
            console.log(`updated ${role.padEnd(11)} ${email}`);
            continue;
        }

        await User.create({
            firstName: 'QA',
            lastName: role,
            email: email.toLowerCase(),
            password,
            role,
            // A superadmin is platform-level and owns no organization.
            organizationId: role === 'superadmin' ? null : org._id,
            isActive: true,
            status: 'Active',
        });
        console.log(`created ${role.padEnd(11)} ${email}`);
    }

    await mongoose.disconnect();
    console.log('\ndone.');
}

main().catch(async (err) => {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch { /* already closed */ }
    process.exit(1);
});
