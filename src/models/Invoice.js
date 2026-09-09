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
 * Tax and total derived from the subtotal. Exported as a pure function so the
 * money rules can be tested without a database connection.
 */
const computeTotals = (subtotal, taxRate) => {
    const base = Number(subtotal) || 0;
    const rate = Number(taxRate) || 0;
    const taxAmount = Math.round(base * (rate / 100));
    return { taxAmount, total: base + taxAmount };
};

/** Sum of payments recorded against an invoice. */
const sumPayments = (payments) => (payments || []).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);

/**
 * The status an invoice should hold given what has been paid against it.
 *
 * Draft and Cancelled are deliberate states set by a person, so they are
 * returned unchanged — an invoice must never auto-advance out of them.
 */
const deriveStatus = ({ status, total, payments, dueDate, now = new Date() }) => {
    if (status === 'Draft' || status === 'Cancelled') return status;

    const paid = sumPayments(payments);
    if (paid <= 0) return dueDate && new Date(dueDate) < now ? 'Overdue' : 'Sent';
    if (paid >= total) return 'Paid';
    return 'Partially Paid';
};

/**
 * Keep derived money fields and status honest on every write, so callers can
 * never persist a total that disagrees with subtotal + tax, or a "Paid" status
 * on an invoice that is not actually settled.
 */
// Mongoose 9 removed the `next` callback style for middleware — Kareem calls
// the hook with no arguments and awaits whatever it returns. Taking a `next`
// parameter here would throw "next is not a function".
invoiceSchema.pre('save', function () {
    const { taxAmount, total } = computeTotals(this.subtotal, this.taxRate);
    this.taxAmount = taxAmount;
    this.total = total;

    this.status = deriveStatus({
        status: this.status,
        total: this.total,
        payments: this.payments,
        dueDate: this.dueDate,
    });
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

// The pure helpers are attached to the export so tests can reach them without
// requiring a live mongoose connection.
Invoice.computeTotals = computeTotals;
Invoice.deriveStatus = deriveStatus;
Invoice.sumPayments = sumPayments;

module.exports = Invoice;
