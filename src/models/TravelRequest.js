const mongoose = require('mongoose');

const travelRequestSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
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

module.exports = mongoose.model('TravelRequest', travelRequestSchema);
