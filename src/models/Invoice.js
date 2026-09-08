const mongoose = require('mongoose');

/**
 * A billable invoice raised against a client, optionally tied to a Project.
 *
 * Revenue is derived from these documents rather than from Project.budget:
 * a budget is what a project was *allocated*, which is not money earned. Only
 * an issued invoice — and the payments recorded against it — represent revenue.
 */
const paymentSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 0 },
    paidOn: { type: Date, default: Date.now },
    method: { type: String, enum: ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Other'], default: 'Bank Transfer' },
    reference: { type: String },
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, trim: true },
    client: { type: String, required: true, trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date },

    // Money is stored in whole rupees, consistent with Project.budget and Payroll.
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    taxRate: { type: Number, default: 18, min: 0, max: 100 }, // GST %, 18 is the common default
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },

    payments: [paymentSchema],

    // 'Draft' is not yet revenue; 'Cancelled'/'Void' never becomes revenue.
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
        default: 'Draft',
    },
    notes: { type: String },

    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Invoice numbers must be unique per tenant, not globally — two organizations
// may legitimately both raise an "INV-001".
invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, issueDate: -1 });

/** Total recorded against this invoice so far. */
invoiceSchema.virtual('amountPaid').get(function () {
    return (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
});

invoiceSchema.virtual('amountDue').get(function () {
    return Math.max(0, (this.total || 0) - this.amountPaid);
});

invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

/**
 * Keep derived money fields and status honest on every write, so callers can
 * never persist a total that disagrees with subtotal + tax, or a "Paid" status
 * on an invoice that is not actually settled.
 */
invoiceSchema.pre('save', function (next) {
    this.taxAmount = Math.round((this.subtotal || 0) * ((this.taxRate || 0) / 100));
    this.total = (this.subtotal || 0) + this.taxAmount;

    // Draft and Cancelled are deliberate states — never auto-advance out of them.
    if (this.status !== 'Draft' && this.status !== 'Cancelled') {
        const paid = (this.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        if (paid <= 0) {
            this.status = this.dueDate && this.dueDate < new Date() ? 'Overdue' : 'Sent';
        } else if (paid >= this.total) {
            this.status = 'Paid';
        } else {
            this.status = 'Partially Paid';
        }
    }
    next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
