const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    level: { type: Number, default: 1 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

designationSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Designation', designationSchema);
