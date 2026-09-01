const Training = require('../models/Training');

const scopeFilter = (req) => {
    const role = (req.user.role || '').toLowerCase();
    return role === 'superadmin' ? {} : { organizationId: req.user.organizationId };
};

// Employee self-enrolls in a training program.
exports.enroll = async (req, res) => {
    try {
        const training = await Training.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            { $addToSet: { assignedTo: req.user._id } },
            { new: true }
        );
        if (!training) return res.status(404).json({ success: false, message: 'Training not found' });
        res.json({ success: true, data: training });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Employee marks a training they're enrolled in as complete.
exports.complete = async (req, res) => {
    try {
        const { score } = req.body;
        const training = await Training.findOne({ _id: req.params.id, ...scopeFilter(req) });
        if (!training) return res.status(404).json({ success: false, message: 'Training not found' });

        const alreadyCompleted = training.completedBy.some(c => String(c.employee) === String(req.user._id));
        if (alreadyCompleted) {
            return res.status(400).json({ success: false, message: 'Already marked complete.' });
        }

        training.completedBy.push({ employee: req.user._id, completedDate: new Date(), score });
        await training.save();
        res.json({ success: true, data: training });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
