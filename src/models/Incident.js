const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    type: { type: String, enum: ['Near Miss', 'Hazard Report', 'Injury', 'Property Damage', 'Environmental', 'Other'], default: 'Hazard Report' },
    site: { type: String, required: true },
    description: { type: String },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: { type: String, enum: ['Reported', 'In-Progress', 'Resolved', 'Closed'], default: 'Reported' },
    date: { type: Date, default: Date.now },
    actionTaken: { type: String },
    investigatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachments: [{ type: String }],
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);
