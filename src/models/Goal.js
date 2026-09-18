const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const goalSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: ['individual', 'team', 'department', 'company'], default: 'individual' },
    targetDate: { type: Date },
    startDate: { type: Date },
    status: { type: String, enum: ['not-started', 'in-progress', 'completed', 'deferred'], default: 'not-started' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    kpis: [{
        name: { type: String },
        target: { type: Number },
        achieved: { type: Number, default: 0 },
        unit: { type: String, default: '%' }
    }],
    weightage: { type: Number, default: 0 }
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
goalSchema.plugin(branchScope);

module.exports = mongoose.model('Goal', goalSchema);
