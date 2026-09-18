/**
 * Migration: move RBAC from a flat role ladder to role x scope.
 *
 * What this does, and just as importantly what it does NOT do.
 *
 * DOES:
 *   1. Gives every organization exactly one default Branch, creating a
 *      "Head Office" when the org has none.
 *   2. Drops Department's legacy { organizationId, name } unique index, which
 *      allowed a department name only once per company. Departments now live
 *      inside a branch, so the constraint is { organizationId, branchId, name }.
 *      Mongo cannot replace an index in place, hence the explicit drop.
 *   3. Points every department with no branch at its org's default branch.
 *   4. Lowercases User.role ('HR' -> 'hr'). The enum used to carry both casings,
 *      so the same role could be stored two ways and compared wrongly.
 *   5. Backfills User.departmentId from the legacy free-text User.department.
 *   6. Marks every existing admin/hr who holds no branches as isGroupWide, so
 *      they keep the organization-wide visibility they have today rather than
 *      losing it to the new fail-closed rule in scopeFilter.
 *   7. Stamps branchId on any other collection whose schema declares one,
 *      discovered at runtime — so as models gain a branchId field, this script
 *      keeps working without being edited.
 *
 * DOES NOT:
 *   Narrow anybody's access. Every user keeps branchIds: [], which reads as
 *   "every branch in my organization" and reproduces today's behaviour exactly.
 *   Confining an admin or HR to specific branches is a deliberate second step,
 *   taken once real branches exist. Likewise, no controller starts filtering by
 *   branch until it opts in with scopeFilter(req, { branch: true }).
 *
 * Usage:
 *   node src/scripts/migrateToBranchScope.js            # dry run (default) - no writes
 *   node src/scripts/migrateToBranchScope.js --commit   # actually writes
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const User = require('../models/User');
const { branchIdOfEmployee } = require('../utils/tenancy');

/**
 * Register every model before the sweep in step 6.
 *
 * That sweep walks mongoose.models to find collections declaring a branchId,
 * so a model nobody required is a model it cannot see — it would report success
 * having silently skipped Attendance, Leave and everything else.
 */
const loadAllModels = () => {
    const dir = path.join(__dirname, '..', 'models');
    for (const file of fs.readdirSync(dir)) {
        if (file.endsWith('.js')) require(path.join(dir, file));
    }
};

const COMMIT = process.argv.includes('--commit');

const LEGACY_DEPARTMENT_INDEX = 'organizationId_1_name_1';
const DEFAULT_BRANCH_NAME = 'Head Office';

// Handled explicitly below; excluded from the generic branchId sweep in step 6.
const EXPLICITLY_HANDLED = new Set(['Department', 'Branch', 'User', 'Organization']);

const log = (...args) => console.log(...args);

/**
 * The branch that existing rows belong to. An org with no branches gets one
 * created; an org that already has several keeps its oldest as the default and
 * is reported, because only a human can say which branch its existing
 * departments really belong to.
 */
async function resolveDefaultBranch(org, report) {
    const existing = await Branch.find({ organizationId: org._id }).sort({ createdAt: 1 });

    if (existing.length > 1) {
        report.ambiguous.push({ org: org.name, branches: existing.length });
    }

    if (existing.length) {
        const chosen = existing.find(b => b.isDefault) || existing[0];
        if (!chosen.isDefault) {
            if (COMMIT) await Branch.updateOne({ _id: chosen._id }, { $set: { isDefault: true } });
            report.branchesMarkedDefault += 1;
        }
        return chosen;
    }

    report.branchesCreated += 1;
    if (!COMMIT) return { _id: `<new-branch-for-${org._id}>`, name: DEFAULT_BRANCH_NAME };

    return Branch.create({
        name: DEFAULT_BRANCH_NAME,
        organizationId: org._id,
        isDefault: true,
        city: org.address?.city,
        state: org.address?.state,
        country: org.address?.country || 'India',
        pincode: org.address?.pincode,
        email: org.email,
        phone: org.phone,
    });
}

async function dropLegacyDepartmentIndex(report) {
    const indexes = await Department.collection.indexes().catch(() => []);
    if (!indexes.some(i => i.name === LEGACY_DEPARTMENT_INDEX)) return;

    report.legacyIndexDropped = true;
    if (COMMIT) {
        await Department.collection.dropIndex(LEGACY_DEPARTMENT_INDEX);
        log(`  dropped legacy index ${LEGACY_DEPARTMENT_INDEX} on departments`);
    }
}

async function normalizeRoles(report) {
    // Compared against the lowercase form rather than listing every legacy
    // spelling, so a casing this script never saw is still caught.
    const users = await User.find({}).select('_id role').lean();
    for (const u of users) {
        if (!u.role) continue;
        const lower = String(u.role).toLowerCase();
        if (lower === u.role) continue;
        report.rolesNormalized.push(`${u.role} -> ${lower}`);
        if (COMMIT) await User.updateOne({ _id: u._id }, { $set: { role: lower } });
    }
}

/**
 * Make "sees every branch" explicit for the branch roles that already have it.
 *
 * An empty branchIds reads as "every branch in my organization". That is now
 * refused for admin and hr unless User.isGroupWide is set (see scopeFilter), so
 * without this step every existing branch admin and branch HR would silently
 * lose access the moment a controller opts into branch narrowing.
 *
 * Marking them preserves exactly today's behaviour while recording it as a
 * decision. Narrowing them afterwards is the deliberate second step: assign
 * real branches and clear the flag.
 */
async function markExistingGroupWide(report) {
    const users = await User.find({
        role: { $in: ['admin', 'hr'] },
        $or: [{ branchIds: { $size: 0 } }, { branchIds: { $exists: false } }],
        isGroupWide: { $ne: true },
    }).select('_id email role').lean();

    for (const u of users) {
        report.markedGroupWide.push(`${u.role} ${u.email}`);
        if (COMMIT) await User.updateOne({ _id: u._id }, { $set: { isGroupWide: true } });
    }
}

async function backfillUserDepartments(report) {
    const users = await User.find({
        department: { $nin: [null, ''] },
        departmentId: null,
    }).select('_id organizationId department').lean();

    for (const u of users) {
        if (!u.organizationId) continue;
        const dept = await Department.findOne({
            organizationId: u.organizationId,
            name: u.department,
        }).select('_id').lean();

        if (!dept) {
            report.departmentsUnmatched.add(u.department);
            continue;
        }
        report.usersLinkedToDepartment += 1;
        if (COMMIT) await User.updateOne({ _id: u._id }, { $set: { departmentId: dept._id } });
    }
}

/**
 * Stamp branchId on every other collection that declares one.
 *
 * Employee-owned rows take the branch their employee is posted to, matching
 * src/models/plugins/branchScope.js — a row records where the person worked,
 * not who wrote it. Only where the employee has no branch does the row fall
 * back to the organization's default.
 *
 * This also repairs rows with no organizationId. Attendance.organizationId was
 * never required, so rows exist with no tenant at all: invisible to every
 * scoped query, and visible to everyone under the fail-open filter that used to
 * live in crudFactory. Where the row names an employee, the tenant is not in
 * doubt, so it is filled in rather than left orphaned.
 */
async function backfillBranchIdOnOtherModels(defaultBranchByOrg, report) {
    const employees = await User.find({})
        .select('_id organizationId branchId branchIds departmentId')
        .lean();

    for (const [name, Model] of Object.entries(mongoose.models)) {
        if (EXPLICITLY_HANDLED.has(name)) continue;
        const paths = Model.schema.paths;
        if (!paths.branchId || !paths.organizationId) continue;

        // Collections name their employee either `employee` or `employeeId`.
        // Only the first was handled before, which silently skipped BankDetail,
        // LeaveBalance and PayoutTransaction.
        const empPath = paths.employee ? 'employee' : (paths.employeeId ? 'employeeId' : null);
        const hasDepartment = Boolean(paths.departmentId);

        if (empPath) {
            for (const emp of employees) {
                const orgKey = String(emp.organizationId || '');
                const fallback = defaultBranchByOrg.get(orgKey);
                const branchId = branchIdOfEmployee(emp) || fallback?._id || null;

                if (emp.organizationId) {
                    const orphanFilter = {
                        [empPath]: emp._id,
                        $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
                    };
                    const orphans = await Model.countDocuments(orphanFilter);
                    if (orphans) {
                        report.orgRepaired[name] = (report.orgRepaired[name] || 0) + orphans;
                        if (COMMIT) {
                            await Model.updateMany(orphanFilter, { $set: { organizationId: emp.organizationId } });
                        }
                    }
                }

                // Department is snapshotted from the employee for the same reason
                // as branch, and matters more: scopeFilter's { department: true }
                // narrows on this field, so a manager sees none of their own
                // history until it is filled in.
                if (hasDepartment && emp.departmentId) {
                    const deptFilter = {
                        [empPath]: emp._id,
                        $or: [{ departmentId: null }, { departmentId: { $exists: false } }],
                    };
                    const deptCount = await Model.countDocuments(deptFilter);
                    if (deptCount) {
                        report.departmentStamped[name] = (report.departmentStamped[name] || 0) + deptCount;
                        if (COMMIT) await Model.updateMany(deptFilter, { $set: { departmentId: emp.departmentId } });
                    }
                }

                if (!branchId) continue;
                const branchFilter = {
                    [empPath]: emp._id,
                    $or: [{ branchId: null }, { branchId: { $exists: false } }],
                };
                const count = await Model.countDocuments(branchFilter);
                if (!count) continue;

                report.branchStamped[name] = (report.branchStamped[name] || 0) + count;
                if (COMMIT) await Model.updateMany(branchFilter, { $set: { branchId } });
            }
        }

        // Rows with no employee to inherit from, and every non-employee-owned
        // collection: these belong to their organization's default branch.
        for (const [orgId, branch] of defaultBranchByOrg) {
            const filter = {
                organizationId: new mongoose.Types.ObjectId(orgId),
                $or: [{ branchId: null }, { branchId: { $exists: false } }],
            };
            const count = await Model.countDocuments(filter);
            if (!count) continue;

            report.branchStamped[name] = (report.branchStamped[name] || 0) + count;
            if (COMMIT) await Model.updateMany(filter, { $set: { branchId: branch._id } });
        }

        // Anything still tenant-less cannot be placed: no organizationId, and its
        // employee does not resolve to a User, so there is nothing to inherit
        // from. Reported rather than silently skipped.
        //
        // On a dry run the repairs above have not been written, so subtract what
        // this pass would have fixed — otherwise the warning double-counts rows
        // the migration is about to place.
        const tenantless = await Model.countDocuments({
            $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
        });
        const stranded = COMMIT ? tenantless : tenantless - (report.orgRepaired[name] || 0);
        if (stranded > 0) report.stranded[name] = stranded;
    }
}

async function main() {
    log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`);
    loadAllModels();
    await mongoose.connect(process.env.MONGODB_URI);
    log(`Connected. ${Object.keys(mongoose.models).length} models registered.\n`);

    const report = {
        branchesCreated: 0,
        branchesMarkedDefault: 0,
        departmentsAssigned: 0,
        usersLinkedToDepartment: 0,
        rolesNormalized: [],
        markedGroupWide: [],
        departmentsUnmatched: new Set(),
        ambiguous: [],
        branchStamped: {},
        departmentStamped: {},
        orgRepaired: {},
        stranded: {},
        legacyIndexDropped: false,
    };

    await dropLegacyDepartmentIndex(report);

    const orgs = await Organization.find({ deletedAt: null });
    log(`Organizations: ${orgs.length}`);

    const defaultBranchByOrg = new Map();

    for (const org of orgs) {
        const branch = await resolveDefaultBranch(org, report);
        defaultBranchByOrg.set(String(org._id), branch);

        const orphanFilter = {
            organizationId: org._id,
            $or: [{ branchId: null }, { branchId: { $exists: false } }],
        };
        const orphans = await Department.countDocuments(orphanFilter);
        if (orphans) {
            report.departmentsAssigned += orphans;
            if (COMMIT) await Department.updateMany(orphanFilter, { $set: { branchId: branch._id } });
        }
    }

    await normalizeRoles(report);
    await backfillUserDepartments(report);
    await markExistingGroupWide(report);
    await backfillBranchIdOnOtherModels(defaultBranchByOrg, report);

    log('\n--- Summary ---');
    log(`Branches created:            ${report.branchesCreated}`);
    log(`Branches marked default:     ${report.branchesMarkedDefault}`);
    log(`Departments given a branch:  ${report.departmentsAssigned}`);
    log(`Users linked to department:  ${report.usersLinkedToDepartment}`);
    log(`Roles normalized:            ${report.rolesNormalized.length}`);
    log(`Branch roles kept group-wide: ${report.markedGroupWide.length}`);
    if (report.markedGroupWide.length) {
        log('  These keep organization-wide visibility until branches are assigned:');
        report.markedGroupWide.forEach(u => log(`    ${u}`));
    }
    if (report.rolesNormalized.length) {
        const counts = report.rolesNormalized.reduce((a, r) => ({ ...a, [r]: (a[r] || 0) + 1 }), {});
        Object.entries(counts).forEach(([k, v]) => log(`    ${k}  x${v}`));
    }
    log(`Legacy dept index dropped:   ${report.legacyIndexDropped}`);
    Object.entries(report.branchStamped).forEach(([m, c]) => log(`branchId stamped on ${m}: ${c}`));
    Object.entries(report.departmentStamped).forEach(([m, c]) => log(`departmentId stamped on ${m}: ${c}`));
    Object.entries(report.orgRepaired).forEach(([m, c]) => log(`organizationId repaired on ${m}: ${c} (was tenant-less)`));

    if (Object.keys(report.stranded).length) {
        log(`\nWARNING: these rows have no organizationId, and their employee does not`);
        log(`resolve to any User — so there is nothing to derive a tenant from. They are`);
        log(`invisible to every tenant-scoped query. Place or delete them by hand:`);
        Object.entries(report.stranded).forEach(([m, c]) => log(`    ${m}: ${c}`));
    }

    if (report.departmentsUnmatched.size) {
        log(`\nWARNING: no Department row matches these User.department strings; those users keep departmentId: null.`);
        [...report.departmentsUnmatched].forEach(d => log(`    "${d}"`));
    }

    if (report.ambiguous.length) {
        log(`\nWARNING: these organizations already had more than one branch. Their existing`);
        log(`departments were all assigned to the oldest branch, which may be wrong — review by hand:`);
        report.ambiguous.forEach(a => log(`    ${a.org} (${a.branches} branches)`));
    }

    if (!COMMIT) log('\nDry run only. Re-run with --commit to apply.');

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Migration failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
