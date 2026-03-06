const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Location = require('../models/Location');
const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');

// =========== DESIGNATIONS ===========
exports.getDesignations = async (req, res) => {
    try {
        const data = await Designation.find().sort({ level: 1, name: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createDesignation = async (req, res) => {
    try {
        const doc = await Designation.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateDesignation = async (req, res) => {
    try {
        const doc = await Designation.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteDesignation = async (req, res) => {
    try {
        await Designation.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== BRANCHES ===========
exports.getBranches = async (req, res) => {
    try {
        const data = await Branch.find().sort({ name: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const doc = await Branch.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const doc = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteBranch = async (req, res) => {
    try {
        await Branch.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== LOCATIONS ===========
exports.getLocations = async (req, res) => {
    try {
        const data = await Location.find().sort({ name: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createLocation = async (req, res) => {
    try {
        const doc = await Location.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateLocation = async (req, res) => {
    try {
        const doc = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteLocation = async (req, res) => {
    try {
        await Location.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== SHIFTS ===========
exports.getShifts = async (req, res) => {
    try {
        const data = await Shift.find().sort({ name: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createShift = async (req, res) => {
    try {
        const doc = await Shift.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateShift = async (req, res) => {
    try {
        const doc = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteShift = async (req, res) => {
    try {
        await Shift.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// =========== HOLIDAYS ===========
exports.getHolidays = async (req, res) => {
    try {
        const filter = {};
        if (req.query.year) filter.year = parseInt(req.query.year);
        const data = await Holiday.find(filter).sort({ date: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createHoliday = async (req, res) => {
    try {
        const doc = await Holiday.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateHoliday = async (req, res) => {
    try {
        const doc = await Holiday.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteHoliday = async (req, res) => {
    try {
        await Holiday.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
