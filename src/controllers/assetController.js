const Asset = require('../models/Asset');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

exports.getAssets = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
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
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const payload = withOrg(req, req.body);
        // Asset IDs run as a per-organization sequence
        const count = await Asset.countDocuments({ organizationId: orgId });
        payload.assetId = payload.assetId || `AST-${String(count + 1).padStart(5, '0')}`;
        const doc = await Asset.create(payload);
        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateAsset = async (req, res) => {
    try {
        const doc = await Asset.findOneAndUpdate(
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

exports.deleteAsset = async (req, res) => {
    try {
        const doc = await Asset.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.assignAsset = async (req, res) => {
    try {
        const { assignedTo, assignedToName } = req.body;
        const doc = await Asset.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            {
                assignedTo, assignedToName,
                assignedDate: new Date(),
                status: 'assigned'
            },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.returnAsset = async (req, res) => {
    try {
        const doc = await Asset.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            {
                assignedTo: null, assignedToName: null,
                assignedDate: null,
                status: 'available',
                condition: req.body.condition || 'good'
            },
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
