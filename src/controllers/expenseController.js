const Expense = require('../models/Expense');

exports.getExpenses = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.category) filter.category = req.query.category;
        const data = await Expense.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createExpense = async (req, res) => {
    try {
        const doc = await Expense.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const doc = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateExpenseStatus = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const update = { status };
        if (status === 'approved') update.approvedAt = new Date();
        if (status === 'reimbursed') update.reimbursedAt = new Date();
        if (status === 'rejected' && rejectionReason) update.rejectionReason = rejectionReason;
        const doc = await Expense.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
