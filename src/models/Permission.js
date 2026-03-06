const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        hoursRequest: {
            type: Number,
            required: true,
            max: [2, 'Maximum permission allowed is 2 hours'],
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending',
        },
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true, // we will pull this from employee.reportingManager, or just find Admin/Manager
        },
        month: {
            type: Number,
            required: true,
        },
        year: {
            type: Number,
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Permission', permissionSchema);
