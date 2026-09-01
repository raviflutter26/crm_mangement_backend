const fs = require('fs');
const path = require('path');
const TaxDocument = require('../models/TaxDocument');

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const scopeFilter = (req) => {
    const role = (req.user.role || '').toLowerCase();
    return role === 'superadmin' ? {} : { organizationId: req.user.organizationId };
};

// Upload a real file and create the TaxDocument record for it.
exports.upload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
        if (!req.user.organizationId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });

        const { documentType, financialYear, quarter, notes, employee } = req.body;
        if (!documentType || !financialYear) {
            return res.status(400).json({ success: false, message: 'documentType and financialYear are required.' });
        }

        const doc = await TaxDocument.create({
            employee: employee || req.user._id,
            documentType,
            financialYear,
            quarter: quarter || null,
            notes,
            fileUrl: `/uploads/tax-documents/${req.file.filename}`,
            fileSize: formatSize(req.file.size),
            uploadedBy: req.user._id,
            organizationId: req.user.organizationId,
        });

        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.status) filter.status = req.query.status;
        const data = await TaxDocument.find(filter).populate('employee', 'firstName lastName employeeId').sort({ createdAt: -1 });
        res.json({ success: true, data, count: data.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getMyRecords = async (req, res) => {
    try {
        const data = await TaxDocument.find({ ...scopeFilter(req), employee: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data, count: data.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { organizationId, employee, fileUrl, fileSize, ...updates } = req.body;
        const doc = await TaxDocument.findOneAndUpdate({ _id: req.params.id, ...scopeFilter(req) }, updates, { new: true, runValidators: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Tax document not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const doc = await TaxDocument.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Tax document not found' });

        if (doc.fileUrl && doc.fileUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../..', doc.fileUrl);
            fs.unlink(filePath, () => {});
        }

        res.json({ success: true, message: 'Tax document deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
