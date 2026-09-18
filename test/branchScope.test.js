const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb } = require('../test-utils/testEnv');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Attendance = require('../src/models/Attendance');
const Leave = require('../src/models/Leave');

/**
 * The branchScope plugin decides which branch an employee-owned row belongs to.
 * It is applied as a hook rather than at each call site because a collection has
 * many write paths — check-in, import, regularize, seeds, the CRUD factory — and
 * every one of them has to reach the same answer.
 */
describe('branchScope plugin', () => {
    const ORG = new mongoose.Types.ObjectId();
    const CHENNAI = new mongoose.Types.ObjectId();
    const BANGALORE = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    const makeEmployee = (overrides = {}) => User.create({
        firstName: 'E', lastName: 'One',
        email: `e-${Math.random().toString(16).slice(2)}@test.local`,
        role: 'employee', organizationId: ORG, ...overrides,
    });

    test('stamps the branch the employee is posted to', async () => {
        const emp = await makeEmployee({ branchId: CHENNAI });
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(String(row.branchId), String(CHENNAI));
    });

    test('applies to leave as well as attendance', async () => {
        const emp = await makeEmployee({ branchId: BANGALORE });
        const row = await Leave.create({
            employee: emp._id, organizationId: ORG, leaveType: 'Casual Leave',
            startDate: new Date(), endDate: new Date(), totalDays: 1, reason: 'test',
        });
        assert.equal(String(row.branchId), String(BANGALORE));
    });

    test('uses the employee\'s branch, not the branch of whoever saved the row', async () => {
        // A group HR entering leave for a Bangalore employee creates Bangalore
        // leave. Nothing about the caller reaches the hook, which is the point.
        const emp = await makeEmployee({ branchId: BANGALORE });
        const row = await Leave.create({
            employee: emp._id, organizationId: ORG, leaveType: 'Sick Leave',
            startDate: new Date(), endDate: new Date(), totalDays: 1, reason: 'test',
        });
        assert.equal(String(row.branchId), String(BANGALORE));
    });

    test('falls back to a single access branch while branchId is unbackfilled', async () => {
        const emp = await makeEmployee({ branchIds: [CHENNAI] });
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(String(row.branchId), String(CHENNAI));
    });

    test('does not guess when the employee may act in several branches', async () => {
        const emp = await makeEmployee({ branchIds: [CHENNAI, BANGALORE] });
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(row.branchId, null, 'an ambiguous posting must stay empty, not pick one');
    });

    test('leaves the row unbranded when the employee has no branch at all', async () => {
        const emp = await makeEmployee();
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(row.branchId, null);
    });

    test('never rewrites a branch already on the row', async () => {
        // The branch is a historical fact: it records where the person worked
        // that day. An employee who later transfers must not rewrite their past.
        const emp = await makeEmployee({ branchId: CHENNAI });
        const row = await Attendance.create({
            employee: emp._id, organizationId: ORG, date: new Date(), branchId: BANGALORE,
        });
        assert.equal(String(row.branchId), String(BANGALORE));

        await User.updateOne({ _id: emp._id }, { $set: { branchId: CHENNAI } });
        row.status = 'Present';
        await row.save();
        assert.equal(String(row.branchId), String(BANGALORE), 'a resave must not re-resolve the branch');
    });

    test('stamps the department the employee belongs to', async () => {
        // Without this, scopeFilter(req, { department: true }) narrows on a field
        // the row does not carry, so a manager matches none of their own rows.
        const dept = new mongoose.Types.ObjectId();
        const emp = await makeEmployee({ branchId: CHENNAI, departmentId: dept });
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(String(row.departmentId), String(dept));
    });

    test('never rewrites a department already on the row', async () => {
        const original = new mongoose.Types.ObjectId();
        const emp = await makeEmployee({ branchId: CHENNAI, departmentId: new mongoose.Types.ObjectId() });
        const row = await Attendance.create({
            employee: emp._id, organizationId: ORG, date: new Date(), departmentId: original,
        });
        assert.equal(String(row.departmentId), String(original));
    });

    test('leaves the department null when the employee has none', async () => {
        const emp = await makeEmployee({ branchId: CHENNAI });
        const row = await Attendance.create({ employee: emp._id, organizationId: ORG, date: new Date() });
        assert.equal(row.departmentId, null);
    });

    test('applies to collections keyed by employeeId, not just employee', async () => {
        const LeaveBalance = require('../src/models/LeaveBalance');
        const dept = new mongoose.Types.ObjectId();
        const emp = await makeEmployee({ branchId: BANGALORE, departmentId: dept });
        const row = await LeaveBalance.create({
            employeeId: emp._id, organizationId: ORG, year: 2026, leaveType: 'Casual Leave',
        });
        assert.equal(String(row.branchId), String(BANGALORE));
        assert.equal(String(row.departmentId), String(dept));
    });

    test('a missing employee does not break the save', async () => {
        const row = await Attendance.create({
            employee: new mongoose.Types.ObjectId(), organizationId: ORG, date: new Date(),
        });
        assert.equal(row.branchId, null);
    });
});

describe('User posting branch invariant', () => {
    const ORG = new mongoose.Types.ObjectId();
    const CHENNAI = new mongoose.Types.ObjectId();
    const BANGALORE = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    const make = (overrides) => User.create({
        firstName: 'A', lastName: 'B',
        email: `u-${Math.random().toString(16).slice(2)}@test.local`,
        organizationId: ORG, ...overrides,
    });

    test('an unrestricted user may be posted anywhere', async () => {
        const u = await make({ role: 'owner', branchIds: [], branchId: CHENNAI });
        assert.equal(String(u.branchId), String(CHENNAI));
    });

    test('a restricted user may be posted to a branch they administer', async () => {
        const u = await make({ role: 'admin', branchIds: [CHENNAI, BANGALORE], branchId: BANGALORE });
        assert.equal(String(u.branchId), String(BANGALORE));
    });

    test('rejects a posting branch the user may not act in', async () => {
        await assert.rejects(
            () => make({ role: 'hr', branchIds: [CHENNAI], branchId: BANGALORE }),
            /Posting branch must be one of the branches/,
        );
    });
});

describe('role enum normalization', () => {
    const ORG = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    test('stores a mixed-case role lowercase', async () => {
        const u = await User.create({
            firstName: 'H', lastName: 'R', email: `hr-${Math.random()}@test.local`,
            role: 'HR', organizationId: ORG,
        });
        assert.equal(u.role, 'hr');
    });

    test('a legacy mixed-case row can still be saved after being read back', async () => {
        // Setters do not run on hydration, so without the post('init') hook a row
        // still holding 'Manager' would fail the lowercase enum on its next save.
        const u = await User.create({
            firstName: 'M', lastName: 'G', email: `m-${Math.random()}@test.local`,
            role: 'manager', organizationId: ORG,
        });
        await User.collection.updateOne({ _id: u._id }, { $set: { role: 'Manager' } });

        const reloaded = await User.findById(u._id);
        assert.equal(reloaded.role, 'manager');
        reloaded.designation = 'Lead';
        await reloaded.save();
        assert.equal((await User.findById(u._id)).role, 'manager');
    });

    test('rejects a role outside the enum', async () => {
        await assert.rejects(() => User.create({
            firstName: 'X', lastName: 'Y', email: `x-${Math.random()}@test.local`,
            role: 'tenant', organizationId: ORG,
        }));
    });
});
