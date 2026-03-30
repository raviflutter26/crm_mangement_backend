const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    parentDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique department names within the same organization
DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', DepartmentSchema);
