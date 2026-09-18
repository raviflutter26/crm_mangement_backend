const mongoose = require('mongoose');

const modulePermissionSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        module: {
            type: String,
            required: true, // e.g., 'dashboard', 'employees', 'payroll'
        },
        // Roles are stored lowercase to match User.role, which lowercases via its
        // own setter. Without this the two sides never compare equal: rows were
        // seeded as 'Admin'/'HR' while every user carries 'admin'/'hr', so any
        // membership check silently matched nothing and granted nobody anything.
        roles: {
            type: [String], // e.g., ['admin', 'hr']
            default: [],
            set: (v) => Array.isArray(v) ? v.filter(Boolean).map(r => String(r).toLowerCase()) : v,
        }
    },
    {
        timestamps: true,
    }
);

// A module's role list is per organization, not global.
modulePermissionSchema.index({ organizationId: 1, module: 1 }, { unique: true });

// Setters do not run on hydration, so a row written before the setter existed
// keeps its original casing until touched. Normalize on read for the same
// reason User does — see the post('init') hook there.
modulePermissionSchema.post('init', function () {
    if (Array.isArray(this.roles)) {
        const lowered = this.roles.map(r => String(r).toLowerCase());
        if (lowered.some((r, i) => r !== this.roles[i])) this.roles = lowered;
    }
});

module.exports = mongoose.model('ModulePermission', modulePermissionSchema);
