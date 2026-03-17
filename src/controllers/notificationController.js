const { sendEmail } = require('../services/emailService');

/**
 * Send manual email via API
 * POST /api/notifications/send-email
 */
exports.sendManualEmail = async (req, res) => {
    try {
        const { to, subject, template, data } = req.body;

        if (!to || !template) {
            return res.status(400).json({
                success: false,
                message: 'Recipient (to) and template name are required.'
            });
        }

        await sendEmail({
            to,
            subject: subject || 'Notification from HRMS',
            template,
            data
        });

        res.status(200).json({
            success: true,
            message: 'Email has been queued successfully.'
        });
    } catch (error) {
        console.error('Error in sendManualEmail controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to queue email.',
            error: error.message
        });
    }
};
