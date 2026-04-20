const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String },
    category: { type: String, enum: ['General', 'Policy Update', 'Meeting', 'Achievement', 'Emergency', 'Other'], default: 'General' },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetRoles: [{ type: String }],
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
