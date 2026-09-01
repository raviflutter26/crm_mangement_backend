const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    client: { type: String },
    description: { type: String },
    status: { type: String, enum: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], default: 'Planning' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    startDate: { type: Date },
    endDate: { type: Date },
    budget: { type: Number, default: 0 },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    site: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
