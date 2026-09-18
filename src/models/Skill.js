const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const skillSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['Technical', 'Safety', 'Management', 'Soft Skills', 'Other'], default: 'Technical' },
    proficiency: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], default: 'Beginner' },
    notes: { type: String, trim: true },
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assessedDate: { type: Date, default: null },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
skillSchema.plugin(branchScope);

module.exports = mongoose.model('Skill', skillSchema);
