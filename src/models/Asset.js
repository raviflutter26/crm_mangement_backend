const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    assetId: { type: String, trim: true },
    type: { type: String, enum: ['laptop', 'desktop', 'monitor', 'phone', 'tablet', 'furniture', 'vehicle', 'id-card', 'other'], default: 'other' },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    purchaseDate: { type: Date },
    purchaseValue: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    warrantyExpiry: { type: Date },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedToName: { type: String, trim: true },
    assignedDate: { type: Date },
    status: { type: String, enum: ['available', 'assigned', 'under-repair', 'retired', 'lost'], default: 'available' },
    condition: { type: String, enum: ['new', 'good', 'fair', 'poor'], default: 'new' },
    notes: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
