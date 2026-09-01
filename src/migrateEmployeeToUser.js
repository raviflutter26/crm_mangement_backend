/**
 * One-off migration: merge `Employee` docs (collection `solar_employees`) into `User` docs
 * (collection `users`), then repoint every other collection's Employee references at the
 * resulting User ids.
 *
 * Usage:
 *   node src/migrateEmployeeToUser.js            # dry run (default) - no writes
 *   node src/migrateEmployeeToUser.js --commit    # actually writes
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');

const User = require('./models/User');
const Employee = require('./models/Employee');

const COMMIT = process.argv.includes('--commit');

// [modelRequirePath, refFieldPath, isArray]
const REF_TARGETS = [
    ['./models/Appraisal', 'employee', false],
    ['./models/Attendance', 'employee', false],
    ['./models/Asset', 'assignedTo', false],
    ['./models/Certification', 'employee', false],
    ['./models/BankDetail', 'employeeId', false],
    ['./models/BankDetail', 'updatedBy', false],
    ['./models/Goal', 'employee', false],
    ['./models/Incident', 'reportedBy', false],
    ['./models/Expense', 'employee', false],
    ['./models/EmployeeDocument', 'employee', false],
    ['./models/LeaveBalance', 'employeeId', false],
    ['./models/Leave', 'employee', false],
    ['./models/Payroll', 'employee', false],
    ['./models/PayoutTransaction', 'employeeId', false],
    ['./models/PPERecord', 'employee', false],
    ['./models/JobCard', 'employee', false],
    ['./models/Project', 'manager', false],
    ['./models/Reimbursement', 'employee', false],
    ['./models/SiteAllowance', 'employee', false],
    ['./models/Timesheet', 'employee', false],
    ['./models/Training', 'assignedTo', true],
    ['./models/Training', 'completedBy.employee', false],
    ['./models/Permission', 'employee', false],
    ['./models/TravelRequest', 'employee', false],
    ['./models/SupportTicket', 'employee', false],
];

const EMPLOYEE_ONLY_FIELDS = [
    'zohoRecordId', 'employeeId', 'profilePhoto', 'reportingManager', 'shift',
    'dateOfJoining', 'dateOfBirth', 'gender', 'maritalStatus', 'bloodGroup', 'nationality',
    'employmentType', 'statutory', 'taxRegime', 'salaryStructure', 'ctc', 'paymentCycle',
    'zohoRoleId', 'zohoRole', 'status', 'location', 'address', 'bankDetails', 'salary',
    'documents', 'emergencyContact', 'workExperience', 'expertise', 'education',
    'modifiedIPAddress', 'syncedFromZoho', 'lastSyncedAt',
];

// Fields both models have where User's existing value wins if already set
const SHARED_FIELDS_USER_WINS = ['role', 'department', 'designation', 'phone'];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

async function main() {
    console.log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const idMap = {}; // oldEmployeeId -> newUserId
    const conflicts = [];
    let merged = 0;
    let created = 0;

    const employees = await Employee.find({});
    console.log(`Found ${employees.length} Employee doc(s) to migrate.`);

    for (const emp of employees) {
        const email = (emp.email || '').toLowerCase();
        if (!email) {
            conflicts.push({ employeeId: emp._id, reason: 'Employee doc has no email, skipped' });
            continue;
        }

        let user = await User.findOne({ email });
        const patch = {};

        for (const field of EMPLOYEE_ONLY_FIELDS) {
            if (emp[field] !== undefined && emp[field] !== null) {
                patch[field] = emp[field];
            }
        }

        // reportingManager currently points at an old Employee _id; remapped in the second pass below
        if (emp.reportingManager) {
            patch.reportingManager = null; // placeholder, fixed after all users exist
        }

        // PAN: keep User's stricter format; validate Employee's before carrying it over
        if (emp.panNumber) {
            const upper = emp.panNumber.toUpperCase();
            if (PAN_REGEX.test(upper)) {
                patch.panNumber = upper;
            } else {
                conflicts.push({ employeeId: emp._id, email, reason: `Invalid PAN format skipped: ${emp.panNumber}` });
                delete patch.panNumber;
            }
        }

        if (user) {
            for (const field of SHARED_FIELDS_USER_WINS) {
                if (user[field] !== undefined && user[field] !== null && user[field] !== '') {
                    delete patch[field];
                } else if (emp[field] !== undefined && emp[field] !== null) {
                    patch[field] = emp[field];
                }
            }

            if (patch.panNumber && user.panNumber && user.panNumber !== patch.panNumber) {
                conflicts.push({ userId: user._id, email, reason: `PAN conflict: user has ${user.panNumber}, employee has ${patch.panNumber} - kept user's` });
                delete patch.panNumber;
            }

            console.log(`MERGE  ${email}  (User ${user._id} <- Employee ${emp._id})`);
            if (COMMIT) {
                Object.assign(user, patch);
                try {
                    await user.save();
                } catch (err) {
                    conflicts.push({ userId: user._id, email, reason: `Save failed: ${err.message}` });
                    continue;
                }
            }
            idMap[emp._id.toString()] = user._id.toString();
            merged++;
        } else {
            console.log(`CREATE ${email}  (new User <- Employee ${emp._id})`);
            if (COMMIT) {
                try {
                    const newUser = await User.create({
                        firstName: emp.firstName,
                        lastName: emp.lastName,
                        email,
                        organizationId: emp.organizationId || null,
                        password: null,
                        isFirstLogin: true,
                        isPasswordSet: false,
                        role: emp.role || 'employee',
                        department: emp.department,
                        designation: emp.designation,
                        phone: emp.phone,
                        ...patch,
                    });
                    idMap[emp._id.toString()] = newUser._id.toString();
                } catch (err) {
                    conflicts.push({ email, reason: `Create failed: ${err.message}` });
                    continue;
                }
            } else {
                idMap[emp._id.toString()] = '<would-create>';
            }
            created++;
        }
    }

    // Second pass: fix reportingManager self-refs now that all target users exist
    if (COMMIT) {
        for (const emp of employees) {
            if (!emp.reportingManager) continue;
            const newSelfId = idMap[emp._id.toString()];
            const newManagerId = idMap[emp.reportingManager.toString()];
            if (newSelfId && newManagerId && newSelfId !== '<would-create>') {
                await User.updateOne({ _id: newSelfId }, { $set: { reportingManager: newManagerId } });
            }
        }
    }

    console.log(`\nUser merge summary: ${merged} merged, ${created} created, ${conflicts.length} conflict(s) logged.`);

    // Bulk-remap the 23 referencing collections
    console.log('\nRemapping Employee references in other collections...');
    const remapSummary = [];
    for (const [modelPath, field, isArray] of REF_TARGETS) {
        const Model = require(modelPath);
        const collName = Model.collection.collectionName;
        for (const [oldId, newId] of Object.entries(idMap)) {
            if (newId === '<would-create>') continue;
            const filter = isArray ? { [field]: oldId } : { [field]: oldId };
            const update = isArray ? { $set: { [`${field}.$[elem]`]: newId } } : { $set: { [field]: newId } };
            const options = isArray ? { arrayFilters: [{ elem: oldId }] } : {};

            const matchCount = await Model.countDocuments(filter);
            if (matchCount === 0) continue;

            remapSummary.push(`${collName}.${field}: ${matchCount} doc(s) reference old Employee ${oldId}`);
            if (COMMIT) {
                await Model.updateMany(filter, update, options);
            }
        }
    }
    remapSummary.forEach((line) => console.log(`  ${line}`));
    if (remapSummary.length === 0) console.log('  (no references found to remap)');

    if (conflicts.length) {
        console.log('\nConflicts / skipped items (review manually):');
        conflicts.forEach((c) => console.log(' ', JSON.stringify(c)));
    }

    const outFile = path.join(__dirname, '..', `migration_output_${COMMIT ? 'commit' : 'dryrun'}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ idMap, conflicts, merged, created }, null, 2));
    console.log(`\nWrote id map + conflicts to ${outFile}`);

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
