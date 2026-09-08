const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // Optional: platform-level superadmin actions belong to no single tenant.
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g., 'Employee Created', 'Leave Approved'
    module: { type: String, required: true }, // e.g., 'Payroll', 'Leaves', 'Employees'
    details: { type: Object, default: {} },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
}, { timestamps: true });

auditLogSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
