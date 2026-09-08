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
        roles: {
            type: [String], // e.g., ['Admin', 'HR']
            default: [],
        }
    },
    {
        timestamps: true,
    }
);

// A module's role list is per organization, not global.
modulePermissionSchema.index({ organizationId: 1, module: 1 }, { unique: true });

module.exports = mongoose.model('ModulePermission', modulePermissionSchema);
