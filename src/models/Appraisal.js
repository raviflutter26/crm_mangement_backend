const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const appraisalSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String, trim: true },
    reviewer: { type: String, trim: true },
    cycle: { type: String, trim: true },
    period: { type: String, trim: true },
    selfRating: { type: Number, min: 1, max: 5 },
    managerRating: { type: Number, min: 1, max: 5 },
    finalRating: { type: Number, min: 1, max: 5 },
    goals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Goal' }],
    selfComments: { type: String, trim: true },
    managerComments: { type: String, trim: true },
    strengths: { type: String, trim: true },
    areasOfImprovement: { type: String, trim: true },
    status: { type: String, enum: ['draft', 'self-review', 'manager-review', 'completed'], default: 'draft' },
    completedAt: { type: Date }
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
appraisalSchema.plugin(branchScope);

module.exports = mongoose.model('Appraisal', appraisalSchema);
