const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ModulePermission = require('./models/ModulePermission');
const Organization = require('./models/Organization');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

/**
 * Seed the per-tenant module grants read by src/middleware/moduleAccess.js.
 *
 * Two things were wrong with the version this replaces. It upserted on
 * { module } alone, so it wrote rows with NO organizationId — which the schema
 * requires and the { organizationId, module } unique index assumes, leaving at
 * most one global row per module that belonged to nobody. And it stored roles
 * capitalised ('Admin') while User.role is lowercase ('admin'), so the two
 * could never compare equal.
 *
 * 'owner' is absent from every list on purpose: the tenant's own top
 * administrator bypasses module grants in the middleware, so that they cannot
 * revoke their own access to the screen that edits these grants.
 */
const MODULE_GRANTS = [
    { module: 'dashboard',    roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'employees',    roles: ['admin', 'hr', 'manager'] },
    { module: 'attendance',   roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'leaves',       roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'permissions',  roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'payroll',      roles: ['admin', 'hr'] },
    { module: 'organization', roles: ['admin', 'hr'] },
    { module: 'departments',  roles: ['admin', 'hr'] },
    { module: 'recruitment',  roles: ['admin', 'hr'] },
    { module: 'performance',  roles: ['admin', 'hr', 'manager'] },
    { module: 'expenses',     roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'compliance',   roles: ['admin'] },
    { module: 'assets',       roles: ['admin', 'hr'] },
    { module: 'self-service', roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'reports',      roles: ['admin', 'hr', 'manager'] },
    { module: 'roles',        roles: ['admin'] },
    { module: 'settings',     roles: ['admin', 'hr', 'manager', 'employee'] },
    { module: 'help',         roles: ['admin', 'hr', 'manager', 'employee'] },
];

const COMMIT = process.argv.includes('--commit');

async function seedPermissions() {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected. ${COMMIT ? 'COMMIT' : 'DRY RUN — pass --commit to write'}`);

    // Clean up the ownerless rows the previous version created. They match no
    // organization, so nothing reads them.
    const orphans = await ModulePermission.countDocuments({ organizationId: { $in: [null, undefined] } });
    if (orphans) {
        console.log(`  removing ${orphans} row(s) with no organizationId`);
        if (COMMIT) await ModulePermission.deleteMany({ organizationId: { $in: [null, undefined] } });
    }

    const orgs = await Organization.find({ deletedAt: null }).select('_id name');
    console.log(`  ${orgs.length} organization(s)`);

    let created = 0, skipped = 0;
    for (const org of orgs) {
        for (const g of MODULE_GRANTS) {
            const existing = await ModulePermission.findOne({ organizationId: org._id, module: g.module });
            if (existing) { skipped++; continue; }
            created++;
            if (COMMIT) {
                await ModulePermission.create({ organizationId: org._id, module: g.module, roles: g.roles });
            }
        }
    }

    console.log(`  ${created} grant(s) to create, ${skipped} already present`);
    console.log(COMMIT ? 'Module permissions seeded.' : 'Dry run complete — nothing written.');
    await mongoose.disconnect();
}

seedPermissions().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
