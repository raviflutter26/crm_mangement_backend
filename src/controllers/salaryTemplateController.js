const SalaryTemplate = require('../models/SalaryTemplate');

/**
 * @desc    Get all salary templates
 * @route   GET /api/salary-templates
 */
exports.getTemplates = async (req, res, next) => {
    try {
        const templates = await SalaryTemplate.find({ isActive: true });
        res.status(200).json({ success: true, count: templates.length, data: templates });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create or Update a salary template
 * @route   POST /api/salary-templates
 */
exports.saveTemplate = async (req, res, next) => {
    try {
        const { name, basicPercent, hraPercent, daPercent, specialAllowancePercent, isDefault, department, role } = req.body;

        if (isDefault) {
            // Unset other defaults if this one is marked as default
            await SalaryTemplate.updateMany({}, { isDefault: false });
        }

        const template = await SalaryTemplate.findOneAndUpdate(
            { name },
            { name, basicPercent, hraPercent, daPercent, specialAllowancePercent, isDefault, department, role },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json({ success: true, data: template });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Calculate salary breakdown based on template and Annual CTC
 * @route   POST /api/salary-templates/calculate
 */
exports.calculateBreakdown = async (req, res, next) => {
    try {
        const { annualCTC, templateId } = req.body;
        if (!annualCTC) return res.status(400).json({ success: false, message: 'Annual CTC is required' });

        let template;
        if (templateId) {
            template = await SalaryTemplate.findById(templateId);
        } else {
            template = await SalaryTemplate.findOne({ isDefault: true });
        }

        if (!template) {
            // Fallback to standard 40/20/10/30 if no template found
            template = {
                basicPercent: 40,
                hraPercent: 20,
                daPercent: 10,
                specialAllowancePercent: 30
            };
        }

        const monthlyCTC = Math.round(annualCTC / 12);
        const breakdown = {
            monthlyCTC,
            basic: Math.round(monthlyCTC * (template.basicPercent / 100)),
            hra: Math.round(monthlyCTC * (template.hraPercent / 100)),
            da: Math.round(monthlyCTC * (template.daPercent / 100)),
            specialAllowance: Math.round(monthlyCTC * (template.specialAllowancePercent / 100))
        };

        // Adjust for rounding errors to ensure sum = monthlyCTC
        const sum = breakdown.basic + breakdown.hra + breakdown.da + breakdown.specialAllowance;
        if (sum !== monthlyCTC) {
            breakdown.specialAllowance += (monthlyCTC - sum);
        }

        res.status(200).json({ success: true, data: breakdown, templateUsed: template.name || 'Default (40/20/10/30)' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a template
 * @route   DELETE /api/salary-templates/:id
 */
exports.deleteTemplate = async (req, res, next) => {
    try {
        await SalaryTemplate.findByIdAndUpdate(req.params.id, { isActive: false });
        res.status(200).json({ success: true, message: 'Template deleted' });
    } catch (error) {
        next(error);
    }
};
