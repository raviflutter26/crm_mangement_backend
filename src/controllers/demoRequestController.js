const DemoRequest = require('../models/DemoRequest');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @desc    Submit a "Request a demo" lead from the public marketing site
 * @route   POST /api/demo-requests
 * @access  Public
 */
exports.createDemoRequest = async (req, res, next) => {
    try {
        const { name, company, email, phone, teamSize, message } = req.body;

        // Company is no longer required: the lead form asks for name, work
        // email, phone and team size only, and rejecting a lead for a field we
        // stopped asking for would silently lose every submission.
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and work email are required.'
            });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        const demoRequest = await DemoRequest.create({
            name: String(name).trim(),
            company: company ? String(company).trim() : undefined,
            email: String(email).trim().toLowerCase(),
            phone: phone ? String(phone).trim() : undefined,
            teamSize: teamSize ? String(teamSize).trim() : undefined,
            message: message ? String(message).trim() : undefined
        });

        res.status(201).json({
            success: true,
            message: "Thanks — we'll be in touch shortly.",
            data: { id: demoRequest._id }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    List demo requests for the SuperAdmin console
 * @route   GET /api/demo-requests
 * @access  SuperAdmin
 */
exports.getDemoRequests = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = status && status !== 'all' ? { status } : {};

        const demoRequests = await DemoRequest.find(query)
            .sort({ createdAt: -1 })
            .limit(200);

        res.status(200).json({
            success: true,
            count: demoRequests.length,
            data: demoRequests
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mark a demo request as contacted/closed
 * @route   PATCH /api/demo-requests/:id/status
 * @access  SuperAdmin
 */
exports.updateDemoRequestStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['new', 'contacted', 'closed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const update = { status };
        if (status === 'contacted') {
            update.contactedAt = new Date();
            update.contactedBy = req.user?._id;
        }

        const demoRequest = await DemoRequest.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!demoRequest) {
            return res.status(404).json({ success: false, message: 'Demo request not found.' });
        }

        res.status(200).json({ success: true, data: demoRequest });
    } catch (error) {
        next(error);
    }
};
