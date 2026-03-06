const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
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

module.exports = mongoose.model('Goal', goalSchema);
