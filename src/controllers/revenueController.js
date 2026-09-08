/**
 * Revenue reporting and invoice management.
 *
 * Every read is scoped through scopeFilter() and every write stamped through
 * withOrg(), so a client-supplied organizationId can never widen the query.
 */
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

// Draft invoices are not yet revenue and Cancelled ones never will be.
const RECOGNISED = ['Sent', 'Partially Paid', 'Paid', 'Overdue'];

const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

/** Sum of payments on an invoice document. */
const paidOf = (inv) => (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);

/**
 * GET /api/revenue/summary
 * Headline figures plus a month-by-month series for the requested year.
 */
exports.getSummary = async (req, res) => {
    try {
        const scope = scopeFilter(req);
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();

        const invoices = await Invoice.find({ ...scope, isActive: true }).lean();

        const recognised = invoices.filter((i) => RECOGNISED.includes(i.status));

        const totalInvoiced = recognised.reduce((s, i) => s + (i.total || 0), 0);
        const totalCollected = recognised.reduce((s, i) => s + paidOf(i), 0);
        const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);
        const overdueInvoices = recognised.filter((i) => i.status === 'Overdue');
        const totalOverdue = overdueInvoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - paidOf(i)), 0);

        // Monthly series for the requested year, indexed 0-11 so the frontend
        // can render all twelve months even where no invoice exists.
        const monthly = Array.from({ length: 12 }, (_, m) => ({
            month: m + 1,
            invoiced: 0,
            collected: 0,
        }));

        for (const inv of recognised) {
            const issued = inv.issueDate ? new Date(inv.issueDate) : null;
            if (issued && issued.getFullYear() === year) {
                monthly[issued.getMonth()].invoiced += inv.total || 0;
            }
            for (const p of inv.payments || []) {
                const paidOn = p.paidOn ? new Date(p.paidOn) : null;
                if (paidOn && paidOn.getFullYear() === year) {
                    monthly[paidOn.getMonth()].collected += p.amount || 0;
                }
            }
        }

        res.json({
            success: true,
            data: {
                year,
                totalInvoiced,
                totalCollected,
                totalOutstanding,
                totalOverdue,
                invoiceCount: recognised.length,
                overdueCount: overdueInvoices.length,
                draftCount: invoices.filter((i) => i.status === 'Draft').length,
                monthly,
            },
        });
    } catch (err) {
        console.error('Revenue getSummary error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/revenue/by-project
 * Revenue actually invoiced against each project, next to that project's budget.
 * This is the honest version of what the Revenue page used to show.
 */
exports.getByProject = async (req, res) => {
    try {
        const scope = scopeFilter(req);
        const match = { ...scope, isActive: true, status: { $in: RECOGNISED } };
        if (match.organizationId) match.organizationId = toObjectId(match.organizationId);

        const rows = await Invoice.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$project',
                    invoiced: { $sum: '$total' },
                    collected: { $sum: { $sum: '$payments.amount' } },
                    invoiceCount: { $sum: 1 },
                },
            },
            { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
            { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    projectId: '$_id',
                    projectName: { $ifNull: ['$project.name', 'Unassigned'] },
                    client: { $ifNull: ['$project.client', '—'] },
                    budget: { $ifNull: ['$project.budget', 0] },
                    invoiced: 1,
                    collected: 1,
                    invoiceCount: 1,
                },
            },
            { $sort: { invoiced: -1 } },
        ]);

        res.json({ success: true, data: rows, count: rows.length });
    } catch (err) {
        console.error('Revenue getByProject error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/** GET /api/revenue/invoices */
exports.getInvoices = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req), isActive: true };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.project) filter.project = req.query.project;

        const invoices = await Invoice.find(filter)
            .populate('project', 'name client')
            .sort({ issueDate: -1 });

        res.json({ success: true, data: invoices, count: invoices.length });
    } catch (err) {
        console.error('Revenue getInvoices error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/** GET /api/revenue/invoices/:id */
exports.getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ _id: req.params.id, ...scopeFilter(req) })
            .populate('project', 'name client');
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.json({ success: true, data: invoice });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/** POST /api/revenue/invoices */
exports.createInvoice = async (req, res) => {
    try {
        if (!requireOrg(req, res)) return;
        // taxAmount/total are recomputed in the model's pre-save hook; accepting
        // them from the client would let the two disagree.
        const { taxAmount, total, ...body } = req.body;
        const invoice = await Invoice.create(withOrg(req, body));
        res.status(201).json({ success: true, data: invoice, message: 'Invoice created successfully' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'An invoice with that number already exists.' });
        }
        console.error('Revenue createInvoice error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/** PUT /api/revenue/invoices/:id */
exports.updateInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ _id: req.params.id, ...scopeFilter(req) });
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

        const { organizationId, taxAmount, total, payments, ...updates } = req.body;
        Object.assign(invoice, updates);
        // save() rather than findOneAndUpdate() so the pre-save hook recomputes
        // tax, total and status.
        await invoice.save();

        res.json({ success: true, data: invoice, message: 'Invoice updated successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

/** POST /api/revenue/invoices/:id/payments — record a payment against an invoice. */
exports.recordPayment = async (req, res) => {
    try {
        const { amount, paidOn, method, reference } = req.body;
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({ success: false, message: 'A positive payment amount is required.' });
        }

        const invoice = await Invoice.findOne({ _id: req.params.id, ...scopeFilter(req) });
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        if (invoice.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot record a payment against a cancelled invoice.' });
        }

        const alreadyPaid = paidOf(invoice);
        if (alreadyPaid + value > invoice.total) {
            return res.status(400).json({
                success: false,
                message: `Payment exceeds the outstanding balance of ${invoice.total - alreadyPaid}.`,
            });
        }

        invoice.payments.push({ amount: value, paidOn: paidOn || new Date(), method, reference });
        await invoice.save();

        res.status(201).json({ success: true, data: invoice, message: 'Payment recorded successfully' });
    } catch (err) {
        console.error('Revenue recordPayment error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

/** DELETE /api/revenue/invoices/:id — soft delete, so revenue history stays auditable. */
exports.deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            { isActive: false },
            { new: true }
        );
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.json({ success: true, message: 'Invoice deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
