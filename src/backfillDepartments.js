/**
 * One-off backfill: creates real Department documents for the two sample orgs seeded by
 * seedSampleOrgHierarchy.js, which set User.department as a free-text string but never
 * created matching Department records (unlike organizationController.createOrganization,
 * which does create them for orgs signed up through the real API).
 *
 * Usage:
 *   node src/backfillDepartments.js            # dry run (default) - no writes
 *   node src/backfillDepartments.js --commit    # actually writes
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Department = require('./models/Department');
const User = require('./models/User');

const COMMIT = process.argv.includes('--commit');

const DEPARTMENTS = ['Engineering', 'Finance', 'Human Resources', 'Operations'];

async function main() {
    console.log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const orgIds = await User.distinct('organizationId', { department: { $in: DEPARTMENTS } });

    for (const orgId of orgIds) {
        const admin = await User.findOne({ organizationId: orgId, role: 'admin' });
        console.log(`\nOrg ${orgId}${admin ? ` (${admin.email})` : ''}:`);

        for (const name of DEPARTMENTS) {
            const existing = await Department.findOne({ organizationId: orgId, name });
            if (existing) {
                console.log(`  SKIP  ${name} (already exists)`);
                continue;
            }

            const managerCandidate = await User.findOne({ organizationId: orgId, department: name, role: 'manager' })
                || await User.findOne({ organizationId: orgId, department: name, role: 'hr' });

            console.log(`  CREATE ${name}${managerCandidate ? ` (manager: ${managerCandidate.firstName} ${managerCandidate.lastName})` : ''}`);

            if (COMMIT) {
                await Department.create({
                    name,
                    code: name.split(' ').map(w => w[0]).join('').toUpperCase(),
                    organizationId: orgId,
                    managerId: managerCandidate ? managerCandidate._id : null,
                    status: 'active',
                    createdBy: admin ? admin._id : null,
                });
            }
        }
    }

    console.log(`\n${COMMIT ? 'Committed' : 'Would commit'} department backfill.`);
    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
