const Expense = require('../models/Expense');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { scopeFilter, withOrg, requireOrg } = require('../utils/tenancy');

exports.getExpenses = async (req, res) => {
    try {
        const filter = { ...scopeFilter(req) };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.employee) filter.employee = req.query.employee;
        if (req.query.category) filter.category = req.query.category;
        const data = await Expense.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createExpense = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const doc = await Expense.create(withOrg(req, req.body));

        // Notify for approval — the employee must belong to the same organization
        const employee = await User.findOne({ _id: doc.employee, organizationId: orgId })
            .populate('reportingManager');
        if (employee) {
            if (employee.reportingManager) {
                await sendEmail({
                    to: employee.reportingManager.email,
                    subject: `New Expense Claim - ${employee.firstName} ${employee.lastName}`,
                    template: 'genericNotification',
                    data: {
                        recipientName: `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`,
                        message: `${employee.firstName} ${employee.lastName} has submitted a new expense claim for ${doc.amount} ${doc.currency || 'INR'}. Category: ${doc.category}`,
                        actionUrl: `${process.env.WEBSITE_URL}/dashboard/expenses`
                    }
                });
            } else {
                // Only this organization's approvers — an unscoped query here emailed
                // every tenant's Admin/HR about one tenant's expense claim.
                const admins = await User.find({
                    role: { $in: ['Admin', 'HR'] },
                    organizationId: orgId,
                }).select('email firstName lastName');
                for (const admin of admins) {
                    await sendEmail({
                        to: admin.email,
                        subject: `[Approval Required] New Expense Claim - ${employee.firstName} ${employee.lastName}`,
                        template: 'genericNotification',
                        data: {
                            recipientName: `${admin.firstName} ${admin.lastName} (HR/Admin)`,
                            message: `${employee.firstName} ${employee.lastName} has submitted a new expense claim for ${doc.amount} ${doc.currency || 'INR'}. Category: ${doc.category}`,
                            actionUrl: `${process.env.WEBSITE_URL}/dashboard/expenses`
                        }
                    });
                }
            }
        }

        res.status(201).json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const doc = await Expense.findOneAndUpdate(
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

exports.deleteExpense = async (req, res) => {
    try {
        const doc = await Expense.findOneAndDelete({ _id: req.params.id, ...scopeFilter(req) });
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateExpenseStatus = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const update = { status };
        if (status === 'approved') update.approvedAt = new Date();
        if (status === 'reimbursed') update.reimbursedAt = new Date();
        if (status === 'rejected' && rejectionReason) update.rejectionReason = rejectionReason;
        const doc = await Expense.findOneAndUpdate(
            { _id: req.params.id, ...scopeFilter(req) },
            update,
            { new: true }
        );
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
