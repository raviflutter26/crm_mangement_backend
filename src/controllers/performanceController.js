const Goal = require('../models/Goal');
const Appraisal = require('../models/Appraisal');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

// =========== GOALS ===========
exports.getGoals = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.status) filter.status = req.query.status;
        const data = await Goal.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createGoal = async (req, res) => {
    try {
        if (!requireOrg(req, res)) return;
        const doc = await Goal.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateGoal = async (req, res) => {
    try {
        const doc = await Goal.findOneAndUpdate(
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

exports.deleteGoal = async (req, res) => {
    try {
        const doc = await Goal.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== APPRAISALS ===========
exports.getAppraisals = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.cycle) filter.cycle = req.query.cycle;
        if (req.query.status) filter.status = req.query.status;
        const data = await Appraisal.find(filter).populate('goals').sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createAppraisal = async (req, res) => {
    try {
        if (!requireOrg(req, res)) return;
        const doc = await Appraisal.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateAppraisal = async (req, res) => {
    try {
        const doc = await Appraisal.findOneAndUpdate(
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

exports.deleteAppraisal = async (req, res) => {
    try {
        const doc = await Appraisal.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
