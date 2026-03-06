const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    ticketId: { type: String, trim: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
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
supportTicketSchema.pre('save', async function (next) {
    if (!this.ticketId) {
        const count = await mongoose.model('SupportTicket').countDocuments();
        this.ticketId = `TKT-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
