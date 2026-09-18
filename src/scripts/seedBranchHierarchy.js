/**
 * Builds the concrete six-role hierarchy on top of the branch scoping added in
 * migrateToBranchScope.js:
 *
 *   superadmin  platform      (already exists, no organization)
 *   owner       organization  created here, one per real tenant
 *   admin       branch        existing admin, given every branch in their org
 *   hr          branch        one per branch — existing HR keeps the main branch,
 *                             new HR users created for the others
 *   manager     department    existing managers, linked to their department
 *   employee    self          existing employees, posted to their branch
 *
 * The branch list mirrors the RBAC brief exactly: Nilgiris runs Ooty and Erode,
 * Cauvery runs Chennai, Coimbatore and Erode, and each branch carries three or
 * four departments with a manager apiece.
 *
 * Note that every branch is now in Tamil Nadu, so this seed no longer exercises
 * cross-state professional tax — PT is a state levy resolved from Branch.state.
 * Add a branch in another state when that path needs covering.
 * Branch.statutory is left blank, so payroll still inherits from the
 * organization until real PF/ESI numbers are filled in.
 *
 * Departments now belong to one branch, so each branch gets its own Human
 * Resources department — the same name in two branches, which is exactly what
 * the new { organizationId, branchId, name } index allows and the old one did not.
 *
 * New users are created WITHOUT a password: isPasswordSet stays false so they go
 * through the existing set-password flow rather than being given a credential
 * invented by this script.
 *
 * Idempotent: re-running matches on slug, branch name, department name and email
 * rather than creating duplicates.
 *
 * Usage:
 *   node src/scripts/seedBranchHierarchy.js            # dry run (default) - no writes
 *   node src/scripts/seedBranchHierarchy.js --commit   # actually writes
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const Department = require('../models/Department');
const User = require('../models/User');

const COMMIT = process.argv.includes('--commit');
const LEGACY_DEPARTMENT_INDEX = 'organizationId_1_name_1';

const log = (...args) => console.log(...args);

const PLAN = [
    {
        slug: 'nilgiris-industries-pvt-ltd',
        owner: { firstName: 'Padmini', lastName: 'Venkatesh', email: 'padmini.venkatesh@nilgirisindustries.test' },
        branches: [
            {
                name: 'Ooty', code: 'OOT', city: 'Udhagamandalam', state: 'Tamil Nadu',
                isDefault: true,
                departments: ['Engineering', 'Operations', 'Finance', 'Human Resources'],
                hr: null, // the org's existing HR is posted here
                managers: {
                    Engineering: { firstName: 'Arul', lastName: 'Murugan', email: 'arul.murugan@nilgirisindustries.test' },
                    Operations: { firstName: 'Kavitha', lastName: 'Raman', email: 'kavitha.raman@nilgirisindustries.test' },
                    Finance: { firstName: 'Suresh', lastName: 'Balan', email: 'suresh.balan@nilgirisindustries.test' },
                },
            },
            {
                name: 'Erode', code: 'ERD', city: 'Erode', state: 'Tamil Nadu',
                departments: ['Engineering', 'Operations', 'Human Resources'],
                hr: { firstName: 'Vasanthi', lastName: 'Perumal', email: 'vasanthi.perumal@nilgirisindustries.test' },
                managers: {
                    Engineering: { firstName: 'Dinesh', lastName: 'Kumar', email: 'dinesh.kumar@nilgirisindustries.test' },
                    Operations: { firstName: 'Latha', lastName: 'Ganesan', email: 'latha.ganesan@nilgirisindustries.test' },
                },
            },
        ],
    },
    {
        slug: 'cauvery-technologies-pvt-ltd',
        owner: { firstName: 'Mohan', lastName: 'Rajagopal', email: 'mohan.rajagopal@cauverytech.test' },
        branches: [
            {
                name: 'Chennai', code: 'CHN', city: 'Chennai', state: 'Tamil Nadu',
                isDefault: true,
                departments: ['Engineering', 'Finance', 'Human Resources'],
                hr: null,
                managers: {
                    Engineering: { firstName: 'Ramesh', lastName: 'Iyer', email: 'ramesh.iyer@cauverytech.test' },
                    Finance: { firstName: 'Deepa', lastName: 'Srinivasan', email: 'deepa.srinivasan@cauverytech.test' },
                },
            },
            {
                name: 'Coimbatore', code: 'CBE', city: 'Coimbatore', state: 'Tamil Nadu',
                departments: ['Engineering', 'Operations', 'Human Resources'],
                hr: { firstName: 'Janani', lastName: 'Sekar', email: 'janani.sekar@cauverytech.test' },
                managers: {
                    Engineering: { firstName: 'Karthik', lastName: 'Nadar', email: 'karthik.nadar@cauverytech.test' },
                    Operations: { firstName: 'Priya', lastName: 'Chandran', email: 'priya.chandran@cauverytech.test' },
                },
            },
            {
                name: 'Erode', code: 'ERD', city: 'Erode', state: 'Tamil Nadu',
                departments: ['Operations', 'Finance', 'Human Resources'],
                hr: { firstName: 'Harini', lastName: 'Gopal', email: 'harini.gopal@cauverytech.test' },
                managers: {
                    Operations: { firstName: 'Vignesh', lastName: 'Subramani', email: 'vignesh.subramani@cauverytech.test' },
                    Finance: { firstName: 'Anitha', lastName: 'Selvam', email: 'anitha.selvam@cauverytech.test' },
                },
            },
        ],
    },
];

const HR_DEPARTMENT = 'Human Resources';

/**
 * The second "Human Resources" department cannot be created while the old
 * per-organization uniqueness constraint is still in place, so drop it here too
 * rather than depending on migrateToBranchScope.js having run first.
 */
async function dropLegacyDepartmentIndex() {
    const indexes = await Department.collection.indexes().catch(() => []);
    if (!indexes.some(i => i.name === LEGACY_DEPARTMENT_INDEX)) return false;
    if (COMMIT) await Department.collection.dropIndex(LEGACY_DEPARTMENT_INDEX);
    return true;
}

/**
 * A stand-in id so a dry run can keep describing the plan without writing.
 * It has to be a real ObjectId, not a readable placeholder string: downstream
 * lookups cast it against ObjectId paths, and a string throws before the plan
 * finishes printing.
 */
const pending = () => new mongoose.Types.ObjectId();

async function upsertBranch(org, spec) {
    const existing = await Branch.findOne({ organizationId: org._id, name: spec.name });
    if (existing) {
        if (COMMIT && spec.isDefault && !existing.isDefault) {
            // Exactly one branch per organization is the default, and scoping
            // falls back to it. Promoting one without demoting the incumbent
            // left two, and which one a fallback picked was then arbitrary.
            await Branch.updateMany(
                { organizationId: org._id, _id: { $ne: existing._id } },
                { $set: { isDefault: false } }
            );
            existing.isDefault = true;
            await existing.save();
        }
        return { doc: existing, created: false };
    }

    if (!COMMIT) return { doc: { _id: pending(), name: spec.name }, created: true };

    if (spec.isDefault) {
        await Branch.updateMany({ organizationId: org._id }, { $set: { isDefault: false } });
    }

    const doc = await Branch.create({
        name: spec.name,
        code: spec.code,
        organizationId: org._id,
        city: spec.city,
        state: spec.state,
        country: 'India',
        isDefault: Boolean(spec.isDefault),
    });
    return { doc, created: true };
}

/**
 * Place a department in a branch. An existing department of that name with no
 * branch is moved rather than duplicated — that row already has employees
 * pointing at it.
 */
async function upsertDepartment(org, branch, name, report, claimed) {
    const inBranch = await Department.findOne({ organizationId: org._id, branchId: branch._id, name });
    if (inBranch) return inBranch;

    const unplaced = await Department.findOne({
        organizationId: org._id,
        name,
        $or: [{ branchId: null }, { branchId: { $exists: false } }],
        // A dry run writes nothing, so the row it just "moved" is still unplaced
        // on the next lookup and would be claimed again — reporting one
        // department moved into several branches and never reporting the
        // creates. Excluding what this run already took keeps the plan honest.
        ...(claimed.size ? { _id: { $nin: [...claimed] } } : {}),
    });

    if (unplaced) {
        claimed.add(unplaced._id);
        report.departmentsMoved.push(`${org.name} / ${name} -> ${branch.name}`);
        if (!COMMIT) return { ...unplaced.toObject(), branchId: branch._id };
        unplaced.branchId = branch._id;
        await unplaced.save();
        return unplaced;
    }

    report.departmentsCreated.push(`${org.name} / ${name} @ ${branch.name}`);
    if (!COMMIT) return { _id: pending(), name, branchId: branch._id };
    return Department.create({ name, organizationId: org._id, branchId: branch._id });
}

/** Assign scope to a user, respecting the branchId-within-branchIds invariant. */
async function scopeUser(user, { branchIds, branchId, departmentId }, report, label) {
    report.usersScoped.push(
        `${label}: ${user.email} -> branch ${branchId ? String(branchId) : 'none'}` +
        `, sees ${branchIds.length ? branchIds.length + ' branch(es)' : 'all branches'}` +
        (departmentId ? `, dept set` : '')
    );
    if (!COMMIT) return;

    user.branchIds = branchIds;
    user.branchId = branchId;
    if (departmentId) user.departmentId = departmentId;
    await user.save();
}

async function createUser(spec, { org, role, branchIds, branchId, departmentId, departmentName }, report) {
    const existing = await User.findOne({ email: spec.email });
    if (existing) {
        await scopeUser(existing, { branchIds, branchId, departmentId }, report, `${role} (existing)`);
        return existing;
    }

    report.usersCreated.push(`${role}: ${spec.firstName} ${spec.lastName} <${spec.email}> @ ${org.name}`);
    if (!COMMIT) return { _id: pending(), email: spec.email };

    return User.create({
        firstName: spec.firstName,
        lastName: spec.lastName,
        email: spec.email,
        role,
        organizationId: org._id,
        branchIds,
        branchId,
        departmentId: departmentId || null,
        department: departmentName || null,
        // No password: the existing set-password flow owns credential creation.
        isPasswordSet: false,
        isFirstLogin: true,
        status: 'Active',
        isActive: true,
    });
}

async function main() {
    log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);
    await mongoose.connect(process.env.MONGODB_URI);

    const report = {
        branchesCreated: [],
        departmentsCreated: [],
        departmentsMoved: [],
        usersCreated: [],
        usersScoped: [],
        warnings: [],
    };

    const droppedIndex = await dropLegacyDepartmentIndex();

    for (const orgPlan of PLAN) {
        const org = await Organization.findOne({ slug: orgPlan.slug, deletedAt: null });
        if (!org) {
            report.warnings.push(`organization not found: ${orgPlan.slug}`);
            continue;
        }

        log(`=== ${org.name} ===`);

        // 1. Branches
        const branches = [];
        for (const spec of orgPlan.branches) {
            const { doc, created } = await upsertBranch(org, spec);
            if (created) report.branchesCreated.push(`${org.name} / ${spec.name} (${spec.state})`);
            branches.push({ spec, doc });
            log(`  branch ${spec.name.padEnd(12)} ${spec.state}`);
        }

        const allBranchIds = branches.map(b => b.doc._id);
        const defaultBranch = (branches.find(b => b.spec.isDefault) || branches[0]).doc;

        // 2. Departments, per branch
        const deptByBranchAndName = new Map();
        const claimedDepartments = new Set();
        for (const { spec, doc } of branches) {
            for (const name of spec.departments) {
                const dept = await upsertDepartment(org, doc, name, report, claimedDepartments);
                deptByBranchAndName.set(`${String(doc._id)}::${name}`, dept);
            }
        }

        // A line department lives in exactly one branch, so its name resolves a
        // branch unambiguously. Human Resources deliberately does not — every
        // branch has one — so HR users are placed explicitly, never by name.
        const branchForLineDept = new Map();
        for (const { spec, doc } of branches) {
            for (const name of spec.departments) {
                if (name === HR_DEPARTMENT) continue;
                branchForLineDept.set(name, { branch: doc, dept: deptByBranchAndName.get(`${String(doc._id)}::${name}`) });
            }
        }

        // 3. Owner — organization scope, so no branch restriction
        await createUser(orgPlan.owner, {
            org, role: 'owner', branchIds: [], branchId: defaultBranch._id,
        }, report);

        // 4. Admin — every branch in their organization
        const admins = await User.find({ organizationId: org._id, role: 'admin' });
        for (const admin of admins) {
            await scopeUser(admin, {
                branchIds: allBranchIds, branchId: defaultBranch._id,
            }, report, 'admin');
        }

        // 5. HR — one per branch. The existing HR keeps the branch whose plan
        //    names no new hire; the rest are created.
        const existingHrs = await User.find({ organizationId: org._id, role: 'hr' });
        let hrPool = [...existingHrs];

        for (const { spec, doc } of branches) {
            const hrDept = deptByBranchAndName.get(`${String(doc._id)}::${HR_DEPARTMENT}`);
            if (spec.hr) {
                await createUser(spec.hr, {
                    org, role: 'hr', branchIds: [doc._id], branchId: doc._id,
                    departmentId: hrDept?._id, departmentName: HR_DEPARTMENT,
                }, report);
                continue;
            }

            const incumbent = hrPool.shift();
            if (!incumbent) {
                report.warnings.push(`${org.name} / ${spec.name}: no HR assigned`);
                continue;
            }
            await scopeUser(incumbent, {
                branchIds: [doc._id], branchId: doc._id, departmentId: hrDept?._id,
            }, report, 'hr');
        }

        if (hrPool.length) {
            report.warnings.push(
                `${org.name}: ${hrPool.length} existing HR user(s) not matched to a branch: ` +
                hrPool.map(h => h.email).join(', ')
            );
        }

        // 5b. One manager per line department, as the brief specifies.
        //
        // Department.managerId is set at the same time: a department whose
        // manager is only implied by User.departmentId has no way to answer
        // "who runs this?", and the two can then disagree.
        for (const { spec, doc } of branches) {
            for (const [deptName, mgrSpec] of Object.entries(spec.managers || {})) {
                const dept = deptByBranchAndName.get(`${String(doc._id)}::${deptName}`);
                if (!dept) {
                    report.warnings.push(`${org.name} / ${spec.name}: no ${deptName} department for its manager`);
                    continue;
                }

                const manager = await createUser(mgrSpec, {
                    org, role: 'manager',
                    branchIds: [doc._id], branchId: doc._id,
                    departmentId: dept._id, departmentName: deptName,
                }, report);

                if (COMMIT && dept._id && String(dept.managerId || '') !== String(manager._id)) {
                    await Department.updateOne({ _id: dept._id }, { $set: { managerId: manager._id } });
                }
            }
        }

        // 6. Managers and employees — posted to the branch of their department
        const staff = await User.find({
            organizationId: org._id,
            role: { $in: ['manager', 'employee'] },
        });

        for (const person of staff) {
            const placed = branchForLineDept.get(person.department);
            if (!placed) {
                report.warnings.push(
                    `${org.name}: ${person.email} has department "${person.department || '(none)'}" ` +
                    `which maps to no branch — left unposted`
                );
                continue;
            }
            await scopeUser(person, {
                branchIds: [placed.branch._id],
                branchId: placed.branch._id,
                departmentId: placed.dept?._id,
            }, report, person.role);
        }

        log('');
    }

    log('--- Summary ---');
    log(`Legacy dept index dropped:  ${droppedIndex}`);
    log(`Branches created:           ${report.branchesCreated.length}`);
    report.branchesCreated.forEach(b => log(`    ${b}`));
    log(`Departments created:        ${report.departmentsCreated.length}`);
    report.departmentsCreated.forEach(d => log(`    ${d}`));
    log(`Departments moved:          ${report.departmentsMoved.length}`);
    report.departmentsMoved.forEach(d => log(`    ${d}`));
    log(`Users created:              ${report.usersCreated.length}`);
    report.usersCreated.forEach(u => log(`    ${u}`));
    log(`Users scoped:               ${report.usersScoped.length}`);

    if (report.warnings.length) {
        log(`\nWARNINGS (${report.warnings.length}):`);
        report.warnings.forEach(w => log(`    ${w}`));
    }

    if (!COMMIT) log('\nDry run only. Re-run with --commit to apply.');

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Seed failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
