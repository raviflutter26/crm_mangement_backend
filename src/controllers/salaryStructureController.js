const SalaryStructure = require('../models/SalaryStructure');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

// Get all salary structures
exports.getStructures = async (req, res, next) => {
    try {
        const structures = await SalaryStructure.find(scopeFilter(req)).sort('-createdAt');
        res.status(200).json({ success: true, data: structures });
    } catch (error) { next(error); }
};

// Create salary structure
exports.createStructure = async (req, res, next) => {
    try {
        if (!requireOrg(req, res)) return;
        const structure = await SalaryStructure.create(withOrg(req, req.body));
        res.status(201).json({ success: true, data: structure });
    } catch (error) { next(error); }
};

// Update salary structure
exports.updateStructure = async (req, res, next) => {
    try {
        const structure = await SalaryStructure.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            withOrg(req, req.body),
            { new: true, runValidators: true }
        );
        if (!structure) return res.status(404).json({ success: false, message: 'Structure not found.' });
        res.status(200).json({ success: true, data: structure });
    } catch (error) { next(error); }
};

// Delete salary structure
exports.deleteStructure = async (req, res, next) => {
    try {
        const structure = await SalaryStructure.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!structure) return res.status(404).json({ success: false, message: 'Structure not found.' });
        res.status(200).json({ success: true, message: 'Deleted.' });
    } catch (error) { next(error); }
};
