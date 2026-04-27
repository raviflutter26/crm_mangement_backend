const Department = require('../models/Department');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res, next) => {
    try {
        const query = {};
        
        // Priority: 1. Query Param (for SuperAdmins) 2. User's own organizationId
        const orgId = req.query.organizationId || (req.user && req.user.organizationId);
        
        if (orgId) {
            query.organizationId = orgId;
        }

        let departments = await Department.find(query).sort({ name: 1 });

        // Safe self-healing auto-seed for existing organizations with no departments
        if (departments.length === 0 && orgId) {
            try {
                const defaultDepts = [
                    'Management', 'Human Resources', 'Sales', 'Installation', 
                    'Engineering', 'Finance', 'Warehouse', 'Customer Support', 'IT'
                ];
                await Department.insertMany(defaultDepts.map(name => ({ 
                    name, 
                    organizationId: orgId,
                    status: 'active'
                })), { ordered: false }); // ordered: false allows continuing on partial failure
                departments = await Department.find(query).sort({ name: 1 });
            } catch (err) {
                // Ignore duplicate key errors from concurrent requests
                departments = await Department.find(query).sort({ name: 1 });
            }
        }

        res.status(200).json({ success: true, data: departments });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private (Admin/HR)
exports.createDepartment = async (req, res, next) => {
    try {
        const department = await Department.create({
            ...req.body,
            organizationId: req.user.organizationId
        });
        res.status(201).json({ success: true, data: department });
    } catch (error) {
        next(error);
    }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private (Admin/HR)
exports.updateDepartment = async (req, res, next) => {
    try {
        const department = await Department.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found in your organization' });
        }

        res.status(200).json({ success: true, data: department });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private (Admin)
exports.deleteDepartment = async (req, res, next) => {
    try {
        const department = await Department.findOneAndDelete({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found in your organization' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
