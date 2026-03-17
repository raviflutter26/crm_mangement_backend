const mongoose = require('mongoose');

const modulePermissionSchema = new mongoose.Schema(
    {
        module: {
            type: String,
            required: true,
            unique: true, // e.g., 'dashboard', 'employees', 'payroll'
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

module.exports = mongoose.model('ModulePermission', modulePermissionSchema);
