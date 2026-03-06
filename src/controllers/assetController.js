const Asset = require('../models/Asset');

exports.getAssets = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.type) filter.type = req.query.type;
        if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
        const data = await Asset.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createAsset = async (req, res) => {
    try {
        // Auto-generate asset ID
        const count = await Asset.countDocuments();
        req.body.assetId = req.body.assetId || `AST-${String(count + 1).padStart(5, '0')}`;
        const doc = await Asset.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateAsset = async (req, res) => {
    try {
        const doc = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteAsset = async (req, res) => {
    try {
        await Asset.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.assignAsset = async (req, res) => {
    try {
        const { assignedTo, assignedToName } = req.body;
        const doc = await Asset.findByIdAndUpdate(req.params.id, {
            assignedTo, assignedToName,
            assignedDate: new Date(),
            status: 'assigned'
        }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.returnAsset = async (req, res) => {
    try {
        const doc = await Asset.findByIdAndUpdate(req.params.id, {
            assignedTo: null, assignedToName: null,
            assignedDate: null,
            status: 'available',
            condition: req.body.condition || 'good'
        }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
