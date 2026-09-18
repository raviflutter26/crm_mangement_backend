const mongoose = require('mongoose');

/**
 * A branch is a location of an organization, not a separate legal entity: the
 * PAN and TAN stay on the Organization, and payroll still runs once per
 * organization per month.
 *
 * What a branch does own is its statutory registration. A company with offices
 * in two states holds a separate PF and ESI registration per state, and
 * professional tax is levied by the state, so PT slabs resolve from this
 * branch's `state` rather than from the organization's. Leaving these blank
 * falls back to Organization.settings.payroll, which is what single-state
 * customers and every pre-branch row already do.
 */
const branchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: 'India', trim: true },
    pincode: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    headOfBranch: { type: String, trim: true },

    // Exactly one branch per organization carries this. The migration marks the
    // branch it creates for existing data, and scoping falls back to it when a
    // write does not name a branch.
    isDefault: { type: Boolean, default: false },

    statutory: {
        pf: {
            registrationNumber: { type: String, default: null, trim: true },
            // Blank inherits Organization.settings.payroll.epfEnabled.
            enabled: { type: Boolean, default: null },
        },
        esi: {
            registrationNumber: { type: String, default: null, trim: true },
            enabled: { type: Boolean, default: null },
        },
        pt: {
            registrationNumber: { type: String, default: null, trim: true },
            enabled: { type: Boolean, default: null },
            // PT is a state levy. Defaults to this branch's `state` at read time;
            // set only when the registration sits in a different state.
            stateOverride: { type: String, default: null, trim: true },
        },
        lwf: {
            registrationNumber: { type: String, default: null, trim: true },
            enabled: { type: Boolean, default: null },
        },
    },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

branchSchema.index({ organizationId: 1, name: 1 }, { unique: true });
branchSchema.index({ organizationId: 1, isDefault: 1 });

/** The state whose PT slabs apply to this branch. */
branchSchema.methods.ptState = function () {
    return this.statutory?.pt?.stateOverride || this.state || null;
};

module.exports = mongoose.model('Branch', branchSchema);
