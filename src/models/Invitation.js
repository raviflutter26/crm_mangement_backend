const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'expired'], 
        default: 'pending' 
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

InvitationSchema.index({ email: 1, organizationId: 1 });

module.exports = mongoose.model('Invitation', InvitationSchema);
