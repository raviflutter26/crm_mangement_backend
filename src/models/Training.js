const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    duration: { type: String },
    status: { type: String, enum: ['New', 'In-Progress', 'Completed', 'Expired'], default: 'New' },
    type: { type: String, enum: ['Safety', 'Technical', 'Compliance', 'Soft Skills', 'Other'], default: 'Technical' },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    completedBy: [{
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        completedDate: { type: Date },
        score: { type: Number }
    }],
    dueDate: { type: Date },
    isActive: { type: Boolean, default: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Training', trainingSchema);
