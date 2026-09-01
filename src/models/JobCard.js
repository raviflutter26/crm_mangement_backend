const mongoose = require('mongoose');

const jobCardSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    site: { type: String, required: true },
    task: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['Ongoing', 'Completed', 'Paused', 'Cancelled'], default: 'Ongoing' },
    startTime: { type: Date },
    endTime: { type: Date },
    totalMinutes: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    notes: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('JobCard', jobCardSchema);
