const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const employeeDocumentSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['PDF', 'IMG', 'DOC', 'XLS', 'Other'], default: 'PDF' },
    category: { type: String, enum: ['Personal', 'Corporate', 'Operations', 'Compliance', 'Tax', 'Other'], default: 'Personal' },
    fileUrl: { type: String },
    size: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
employeeDocumentSchema.plugin(branchScope);

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);
