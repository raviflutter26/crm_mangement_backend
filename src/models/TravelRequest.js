const mongoose = require('mongoose');

const branchScope = require('./plugins/branchScope');
const travelRequestSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    site: { type: String, required: true },
    type: { type: String, enum: ['Site Visit', 'Material Pickup', 'Client Meeting', 'Training', 'Other'], default: 'Site Visit' },
    purpose: { type: String },
    travelDate: { type: Date, required: true },
    returnDate: { type: Date },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transport: { type: String },
    estimatedCost: { type: Number, default: 0 },
    notes: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });


// Branch is resolved from the employee the row belongs to, not from whoever
// saved it, and snapshotted so a transfer never rewrites history.
travelRequestSchema.plugin(branchScope);

module.exports = mongoose.model('TravelRequest', travelRequestSchema);
