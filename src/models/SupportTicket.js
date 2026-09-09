const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ticketId: { type: String, trim: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: ['it-support', 'hr-query', 'payroll', 'facilities', 'leave', 'general', 'other'], default: 'general' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['open', 'in-progress', 'resolved', 'closed'], default: 'open' },
    assignedTo: { type: String, trim: true },
    resolution: { type: String, trim: true },
    resolvedAt: { type: Date }
}, { timestamps: true });

// Auto-generate ticket ID
// Mongoose 9 removed the `next` callback style for middleware: the hook is
// called with no arguments and whatever it returns is awaited.
supportTicketSchema.pre('save', async function () {
    if (!this.ticketId) {
        // Sequence is per organization so ticket numbers don't leak platform-wide volume.
        const count = await mongoose.model('SupportTicket').countDocuments({ organizationId: this.organizationId });
        this.ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;
    }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
