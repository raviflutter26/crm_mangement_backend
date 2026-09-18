const mongoose = require('mongoose');
const { branchIdOfEmployee } = require('../../utils/tenancy');

/**
 * Gives a collection a branchId and a departmentId, and keeps them filled in.
 *
 * Employee-owned rows belong to the branch and department their employee is
 * posted to, so both values are resolved from that employee rather than from
 * whoever saved the row. A group HR entering leave for a Bangalore employee
 * creates Bangalore leave, in that employee's department.
 *
 * Applying this as a plugin rather than editing each write path matters because
 * there are many write paths per collection — check-in, bulk import, regularize,
 * seed scripts, the CRUD factory — and every one of them has to stamp the same
 * value. A hook covers paths that do not exist yet.
 *
 * The stored values are deliberately a snapshot, not a live lookup: attendance
 * records where the person worked and under whom, and an employee who transfers
 * must not rewrite their own history. Only rows with no value yet are filled in.
 *
 * departmentId is what makes manager scoping possible at all. scopeFilter's
 * { department: true } narrows on a departmentId field, so a collection without
 * one cannot be filtered for a manager — it would match nothing rather than
 * their department.
 *
 * Usage:
 *   schema.plugin(branchScope);                              // employee-owned
 *   schema.plugin(branchScope, { employeePath: 'employeeId' });
 *   schema.plugin(branchScope, { employeePath: null });       // fields only
 */
module.exports = function branchScope(schema, opts = {}) {
    const employeePath = opts.employeePath === undefined ? 'employee' : opts.employeePath;

    schema.add({
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
            index: true,
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            default: null,
            index: true,
        },
    });

    if (!employeePath) return;

    // Mongoose 9 removed the `next` callback style: a hook takes no arguments
    // and whatever it returns is awaited. See test/modelHooks.test.js.
    schema.pre('validate', async function () {
        if (this.branchId && this.departmentId) return;

        const employeeId = this.get(employeePath);
        if (!employeeId) return;

        // Resolved lazily by name so this file never imports the User model,
        // which would be circular once User itself grows branch-scoped children.
        const employee = await mongoose
            .model('User')
            .findById(employeeId)
            .select('branchId branchIds departmentId')
            .lean()
            .catch(() => null);

        if (!employee) return;

        if (!this.branchId) {
            const resolved = branchIdOfEmployee(employee);
            if (resolved) this.branchId = resolved;
        }

        if (!this.departmentId && employee.departmentId) {
            this.departmentId = employee.departmentId;
        }
    });
};
