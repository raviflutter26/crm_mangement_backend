const mongoose = require('mongoose');

const DemoRequestSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    teamSize: { type: String, trim: true },
    message: { type: String, trim: true },
    source: { type: String, default: 'marketing-website' },
    status: {
        type: String,
        enum: ['new', 'contacted', 'closed'],
        default: 'new'
    },
    contactedAt: { type: Date },
    contactedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

DemoRequestSchema.index({ createdAt: -1 });
DemoRequestSchema.index({ status: 1 });

module.exports = mongoose.model('DemoRequest', DemoRequestSchema);
