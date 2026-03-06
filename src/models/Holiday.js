const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['national', 'regional', 'company', 'restricted'], default: 'company' },
    isOptional: { type: Boolean, default: false },
    year: { type: Number, required: true },
    description: { type: String, trim: true },
    applicableBranches: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
