const mongoose = require('mongoose');

const appraisalSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
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

module.exports = mongoose.model('Appraisal', appraisalSchema);
