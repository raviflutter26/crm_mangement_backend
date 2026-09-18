const mongoose = require('mongoose');

/**
 * A department belongs to exactly one branch.
 *
 * That makes the hierarchy a true tree — organization > branch > department >
 * employee — so a manager's scope nests inside their branch HR's scope. The
 * alternative, one company-wide department spanning branches, would let a
 * manager see employees their own branch HR could not, because the two scopes
 * would cross rather than nest.
 *
 * The practical consequence is that "Engineering" in Chennai and "Engineering"
 * in Bangalore are two departments, which is why the uniqueness constraint is
 * per branch rather than per organization.
 */
const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    parentDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Department names are unique within a branch, not within the organization, so
// the same name may exist once per branch. Replaces the old
// { organizationId, name } index — see src/scripts/migrateToBranchScope.js, which
// drops it, since Mongo will not replace an index in place.
DepartmentSchema.index({ organizationId: 1, branchId: 1, name: 1 }, { unique: true });

// Frontend reads/writes a boolean `isActive` toggle; the schema's source of truth is `status`.
DepartmentSchema.virtual('isActive')
    .get(function () { return this.status !== 'inactive'; })
    .set(function (value) { this.status = value === false ? 'inactive' : 'active'; });

module.exports = mongoose.model('Department', DepartmentSchema);
