const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g., 'Employee Created', 'Leave Approved'
    module: { type: String, required: true }, // e.g., 'Payroll', 'Leaves', 'Employees'
    details: { type: Object, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
