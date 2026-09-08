const SupportTicket = require('../models/SupportTicket');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

exports.getTickets = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.priority) filter.priority = req.query.priority;
        if (req.query.category) filter.category = req.query.category;
        const data = await SupportTicket.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createTicket = async (req, res) => {
    try {
        if (!requireOrg(req, res)) return;
        const doc = await SupportTicket.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const doc = await SupportTicket.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            withOrg(req, req.body),
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteTicket = async (req, res) => {
    try {
        const doc = await SupportTicket.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        const { status, resolution } = req.body;
        const update = { status };
        if (resolution) update.resolution = resolution;
        if (status === 'resolved' || status === 'closed') update.resolvedAt = new Date();
        const doc = await SupportTicket.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            update,
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
