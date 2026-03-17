const Department = require('../models/Department');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private
exports.getDepartments = async (req, res, next) => {
    try {
        let departments = await Department.find().sort({ name: 1 });
        
        // Auto-seed for demo if empty
        if (departments.length === 0) {
            const defaultDepts = [
                'Management', 'Human Resources', 'Sales', 'Installation', 
                'Engineering', 'Finance', 'Warehouse', 'Customer Support', 'IT'
            ];
            await Department.insertMany(defaultDepts.map(name => ({ name })));
            departments = await Department.find().sort({ name: 1 });
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
        const department = await Department.create(req.body);
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
        const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
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
        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        await department.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
