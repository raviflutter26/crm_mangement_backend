const SalaryStructure = require('../models/SalaryStructure');

// Get all salary structures
exports.getStructures = async (req, res, next) => {
    try {
        const structures = await SalaryStructure.find({}).sort('-createdAt');
        res.status(200).json({ success: true, data: structures });
    } catch (error) { next(error); }
};

// Create salary structure
exports.createStructure = async (req, res, next) => {
    try {
        const structure = await SalaryStructure.create(req.body);
        res.status(201).json({ success: true, data: structure });
    } catch (error) { next(error); }
};

// Update salary structure
exports.updateStructure = async (req, res, next) => {
    try {
        const structure = await SalaryStructure.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!structure) return res.status(404).json({ success: false, message: 'Structure not found.' });
        res.status(200).json({ success: true, data: structure });
    } catch (error) { next(error); }
};

// Delete salary structure
exports.deleteStructure = async (req, res, next) => {
    try {
        const structure = await SalaryStructure.findByIdAndDelete(req.params.id);
        if (!structure) return res.status(404).json({ success: false, message: 'Structure not found.' });
        res.status(200).json({ success: true, message: 'Deleted.' });
    } catch (error) { next(error); }
};
