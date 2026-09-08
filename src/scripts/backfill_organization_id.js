/**
 * Backfill organizationId onto the collections that gained tenant scoping.
 *
 * Sixteen models now declare organizationId as required, but documents written
 * before that change do not have the field. Any save() on such a document fails
 * validation, and every scoped read skips it. This script stamps them.
 *
 * Strategy, per collection, in order of preference:
 *   1. Derive from a referenced document (the employee/user the row belongs to,
 *      or the parent payroll record).
 *   2. Fall back to --default-org, for rows with nothing to derive from
 *      (singleton config documents, orphaned rows).
 *
 * Some collections held a single document shared by every tenant — one statutory
 * config, one compliance-settings row, one set of salary components, one module
 * permission matrix. Those cannot be "assigned" to an organization without
 * taking the settings away from the others, so --clone-shared copies each shared
 * document once per organization and then removes the unowned original.
 *
 * Usage:
 *   node src/scripts/backfill_organization_id.js                        # dry run
 *   node src/scripts/backfill_organization_id.js --clone-shared         # dry run incl. clone plan
 *   node src/scripts/backfill_organization_id.js --clone-shared --apply
 *   node src/scripts/backfill_organization_id.js --default-org=<id> --apply
 *
 * Dry run is the default and writes nothing. Run it first and read the report.
 */

const mongoose = require('mongoose');
const config = require('../config');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CLONE_SHARED = args.includes('--clone-shared');
const defaultOrgArg = args.find((a) => a.startsWith('--default-org='));
const DEFAULT_ORG = defaultOrgArg ? defaultOrgArg.split('=')[1] : null;

/**
 * Collections whose unowned documents are shared configuration rather than one
 * tenant's data. Cloning preserves every organization's current behaviour;
 * assigning to a single org would silently reset the other six to defaults.
 */
const SHARED_CONFIG_COLLECTIONS = new Set([
    'salarycomponents',
    'salarystructures',
    'statutory_configs',
    'compliancesettings',
    'attendancepolicies',
    'modulepermissions',
]);

/** organizationId is optional on these, so an unresolved row is not a problem. */
const ORG_OPTIONAL_COLLECTIONS = new Set(['auditlogs']);

// collection -> how to find the owning organization for one document
// `via` names a field holding a ref; `from` is the collection to look it up in.
const PLAN = [
    { collection: 'salarystructures', via: null },
    { collection: 'salarycomponents', via: null },
    { collection: 'statutory_configs', via: null, legacyField: 'companyId' },
    { collection: 'compliancesettings', via: null },
    { collection: 'attendancepolicies', via: null },
    { collection: 'modulepermissions', via: null },
    { collection: 'bankdetails', via: 'employeeId', from: 'users' },
    { collection: 'expenses', via: 'employee', from: 'users' },
    { collection: 'assets', via: 'assignedTo', from: 'users' },
    { collection: 'appraisals', via: 'employee', from: 'users' },
    { collection: 'goals', via: 'employee', from: 'users' },
    { collection: 'supporttickets', via: 'employee', from: 'users' },
    { collection: 'notifications', via: 'userId', from: 'users' },
    { collection: 'payouttransactions', via: 'employeeId', from: 'users' },
    { collection: 'payroll_reports', via: 'generatedBy', from: 'users' },
    { collection: 'auditlogs', via: 'userId', from: 'users' },
];

const run = async () => {
    await mongoose.connect(config.mongodbUri);
    const db = mongoose.connection.db;
    console.log(`\nConnected to "${db.databaseName}"`);
    console.log(APPLY ? '⚠️  APPLY MODE — documents will be written\n' : '🔍 DRY RUN — nothing will be written\n');

    if (DEFAULT_ORG && !mongoose.Types.ObjectId.isValid(DEFAULT_ORG)) {
        throw new Error(`--default-org=${DEFAULT_ORG} is not a valid ObjectId`);
    }

    const orgs = await db.collection('organizations').find({}, { projection: { name: 1 } }).toArray();
    console.log(`Organizations in this database: ${orgs.length}`);
    orgs.forEach((o) => console.log(`  ${o._id}  ${o.name || '(unnamed)'}`));

    if (!DEFAULT_ORG && orgs.length === 1) {
        console.log(`\nNote: exactly one organization exists. Re-run with --default-org=${orgs[0]._id} to use it as the fallback.`);
    }
    console.log('');

    const userOrgCache = new Map();
    const orgOfUser = async (userId) => {
        if (!userId) return null;
        const key = String(userId);
        if (userOrgCache.has(key)) return userOrgCache.get(key);
        const user = await db.collection('users').findOne(
            { _id: new mongoose.Types.ObjectId(key) },
            { projection: { organizationId: 1 } }
        );
        const org = user?.organizationId || null;
        userOrgCache.set(key, org);
        return org;
    };

    const summary = [];

    for (const step of PLAN) {
        const col = db.collection(step.collection);
        const missing = await col.find({
            $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
        }).toArray();

        if (missing.length === 0) {
            summary.push({ collection: step.collection, total: 0, derived: 0, fallback: 0, cloned: 0, unresolved: 0 });
            continue;
        }

        let derived = 0;
        let fallback = 0;
        let unresolved = 0;
        const writes = [];

        for (const doc of missing) {
            let orgId = null;

            // 1. a legacy tenant key on the same document
            if (step.legacyField && doc[step.legacyField]) {
                const legacy = doc[step.legacyField];
                if (orgs.some((o) => String(o._id) === String(legacy))) {
                    orgId = legacy;
                }
            }

            // 2. derive from the referenced user
            if (!orgId && step.via && doc[step.via]) {
                orgId = await orgOfUser(doc[step.via]);
                if (orgId) derived++;
            }

            // 3. fall back
            if (!orgId && DEFAULT_ORG) {
                orgId = new mongoose.Types.ObjectId(DEFAULT_ORG);
                fallback++;
            }

            if (!orgId) {
                unresolved++;
                continue;
            }

            writes.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { organizationId: new mongoose.Types.ObjectId(String(orgId)) } },
                },
            });
        }

        // Shared config: clone once per organization instead of picking a winner
        let cloned = 0;
        if (CLONE_SHARED && SHARED_CONFIG_COLLECTIONS.has(step.collection) && orgs.length > 0) {
            const stillUnowned = missing.filter((doc) => {
                const alreadyPlanned = writes.some((w) => String(w.updateOne.filter._id) === String(doc._id));
                return !alreadyPlanned;
            });

            const inserts = [];
            const deleteIds = [];
            for (const doc of stillUnowned) {
                for (const org of orgs) {
                    const copy = { ...doc, organizationId: org._id };
                    delete copy._id; // let Mongo assign a new id per tenant copy
                    delete copy.companyId;
                    inserts.push(copy);
                }
                deleteIds.push(doc._id);
                cloned += orgs.length;
            }

            if (APPLY && inserts.length > 0) {
                await col.insertMany(inserts, { ordered: false });
                await col.deleteMany({ _id: { $in: deleteIds } });
            }

            // These are now handled, so they are no longer unresolved
            unresolved -= stillUnowned.length;
            if (unresolved < 0) unresolved = 0;
        }

        if (APPLY && writes.length > 0) {
            await col.bulkWrite(writes, { ordered: false });
        }

        summary.push({
            collection: step.collection,
            total: missing.length,
            derived,
            fallback,
            cloned,
            unresolved,
        });
    }

    console.log('Collection                  needing  derived  fallback   cloned  UNRESOLVED');
    console.log('─'.repeat(78));
    let totalUnresolved = 0;
    let totalCloned = 0;
    for (const r of summary) {
        if (r.total === 0) continue;
        const blocking = ORG_OPTIONAL_COLLECTIONS.has(r.collection) ? 0 : r.unresolved;
        totalUnresolved += blocking;
        totalCloned += r.cloned;
        console.log(
            r.collection.padEnd(26) +
            String(r.total).padStart(8) +
            String(r.derived).padStart(9) +
            String(r.fallback).padStart(10) +
            String(r.cloned).padStart(9) +
            String(r.unresolved).padStart(12) +
            (ORG_OPTIONAL_COLLECTIONS.has(r.collection) && r.unresolved ? '  (optional — ok to leave)' : '')
        );
    }
    if (totalCloned > 0) {
        console.log(`\n${totalCloned} tenant copies would be created across ${orgs.length} organizations.`);
    }
    if (summary.every((r) => r.total === 0)) {
        console.log('  (nothing to backfill — every document already has an organizationId)');
    }
    console.log('');

    if (totalUnresolved > 0) {
        console.log(`⚠️  ${totalUnresolved} document(s) could not be assigned an organization.`);
        console.log('   Shared config rows: re-run with --clone-shared to give every organization its own copy.');
        console.log('   Anything else: use --default-org=<organizationId>, or delete them if they are dead rows.');
    }
    console.log(APPLY ? '✅ Backfill applied.' : '🔍 Dry run complete — re-run with --apply to write.');

    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('\n❌ Backfill failed:', err.message);
    process.exit(1);
});
