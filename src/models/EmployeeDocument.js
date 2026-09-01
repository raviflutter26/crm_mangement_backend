const mongoose = require('mongoose');

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

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);
