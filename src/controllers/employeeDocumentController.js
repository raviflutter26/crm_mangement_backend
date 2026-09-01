const fs = require('fs');
const path = require('path');
const EmployeeDocument = require('../models/EmployeeDocument');

const typeFromMime = (mimetype) => {
    if (mimetype === 'application/pdf') return 'PDF';
    if (mimetype.startsWith('image/')) return 'IMG';
    if (mimetype.includes('word')) return 'DOC';
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'XLS';
    return 'Other';
};

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Upload a real file and create the EmployeeDocument record for it.
exports.upload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
        if (!req.user.organizationId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });

        const { name, category } = req.body;
        const doc = await EmployeeDocument.create({
            employee: req.body.employee || req.user._id,
            name: name || req.file.originalname,
            type: typeFromMime(req.file.mimetype),
            category: category || 'Personal',
            fileUrl: `/uploads/employee-documents/${req.file.filename}`,
            size: formatSize(req.file.size),
            uploadedBy: req.user._id,
            organizationId: req.user.organizationId,
        });

        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Delete the record and its backing file together.
exports.remove = async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();
        const scopeFilter = role === 'superadmin' ? {} : { organizationId: req.user.organizationId };
        const doc = await EmployeeDocument.findOneAndDelete({ _id: req.params.id, ...scopeFilter });
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        if (doc.fileUrl && doc.fileUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../..', doc.fileUrl);
            fs.unlink(filePath, () => {}); // best-effort cleanup
        }

        res.json({ success: true, message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
