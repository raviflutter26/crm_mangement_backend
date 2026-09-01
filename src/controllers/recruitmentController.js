const JobPosting = require('../models/JobPosting');
const Candidate = require('../models/Candidate');

// Non-superadmin requests are always scoped to the caller's own organization.
const orgFilter = (req) => {
    const role = (req.user.role || '').toLowerCase();
    if (role === 'superadmin') return {};
    return { organizationId: req.user.organizationId };
};

// =========== JOB POSTINGS ===========
exports.getJobPostings = async (req, res) => {
    try {
        const filter = { ...orgFilter(req) };
        if (req.query.status) filter.status = req.query.status;
        const data = await JobPosting.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createJobPosting = async (req, res) => {
    try {
        if (!req.user.organizationId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });
        const doc = await JobPosting.create({ ...req.body, organizationId: req.user.organizationId });
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateJobPosting = async (req, res) => {
    try {
        const { organizationId, ...updates } = req.body;
        const doc = await JobPosting.findOneAndUpdate({ _id: req.params.id, ...orgFilter(req) }, updates, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteJobPosting = async (req, res) => {
    try {
        const doc = await JobPosting.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== CANDIDATES ===========
exports.getCandidates = async (req, res) => {
    try {
        const filter = { ...orgFilter(req) };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.jobPosting) filter.jobPosting = req.query.jobPosting;
        const data = await Candidate.find(filter).populate('jobPosting', 'title department').sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createCandidate = async (req, res) => {
    try {
        if (!req.user.organizationId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });
        const doc = await Candidate.create({ ...req.body, organizationId: req.user.organizationId });
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateCandidate = async (req, res) => {
    try {
        const { organizationId, ...updates } = req.body;
        const doc = await Candidate.findOneAndUpdate({ _id: req.params.id, ...orgFilter(req) }, updates, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteCandidate = async (req, res) => {
    try {
        const doc = await Candidate.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateCandidateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const doc = await Candidate.findOneAndUpdate({ _id: req.params.id, ...orgFilter(req) }, { status }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
