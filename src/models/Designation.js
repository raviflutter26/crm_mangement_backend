const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    level: { type: Number, default: 1 },
    department: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Designation', designationSchema);
