const JobPosting = require('../models/JobPosting');
const Candidate = require('../models/Candidate');

// =========== JOB POSTINGS ===========
exports.getJobPostings = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const data = await JobPosting.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createJobPosting = async (req, res) => {
    try {
        const doc = await JobPosting.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateJobPosting = async (req, res) => {
    try {
        const doc = await JobPosting.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteJobPosting = async (req, res) => {
    try {
        await JobPosting.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== CANDIDATES ===========
exports.getCandidates = async (req, res) => {
    try {
        const filter = {};
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
        const doc = await Candidate.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateCandidate = async (req, res) => {
    try {
        const doc = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteCandidate = async (req, res) => {
    try {
        await Candidate.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateCandidateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const doc = await Candidate.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
