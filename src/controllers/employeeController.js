const Employee = require('../models/Employee');
const zohoPeopleService = require('../services/zohoPeopleService');

/**
 * @desc    Get all employees
 * @route   GET /api/employees
 */
exports.getEmployees = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            department,
            status,
            sort = '-createdAt',
        } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
            ];
        }
        if (department) query.department = department;
        if (status) query.status = status;

        const employees = await Employee.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Employee.countDocuments(query);

        res.status(200).json({
            success: true,
            data: employees,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single employee
 * @route   GET /api/employees/:id
 */
exports.getEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create employee
 * @route   POST /api/employees
 */
exports.createEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.create(req.body);
        res.status(201).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update employee
 * @route   PUT /api/employees/:id
 */
exports.updateEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete employee
 * @route   DELETE /api/employees/:id
 */
exports.deleteEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }
        res.status(200).json({ success: true, message: 'Employee deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Sync employees from Zoho People
 * @route   POST /api/employees/sync
 */
exports.syncFromZoho = async (req, res, next) => {
    try {
        const zohoEmployees = await zohoPeopleService.getEmployees();
        let synced = 0;
        let errors = 0;

        // Process Zoho data (shape depends on actual API response)
        if (zohoEmployees && zohoEmployees.response && zohoEmployees.response.result) {
            const records = zohoEmployees.response.result;
            for (const record of records) {
                try {
                    await Employee.findOneAndUpdate(
                        { zohoRecordId: record.recordId },
                        {
                            zohoRecordId: record.recordId,
                            firstName: record.FirstName || '',
                            lastName: record.LastName || '',
                            email: record.EmailID || '',
                            employeeId: record.EmployeeID || record.recordId,
                            department: record.Department || null,
                            designation: record.Designation || null,
                            phone: record.Mobile || null,
                            dateOfJoining: record.Dateofjoining || null,
                            syncedFromZoho: true,
                            lastSyncedAt: new Date(),
                        },
                        { upsert: true, new: true }
                    );
                    synced++;
                } catch (err) {
                    errors++;
                    console.error(`Failed to sync employee ${record.EmployeeID}:`, err.message);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: `Sync complete. Synced: ${synced}, Errors: ${errors}`,
            data: { synced, errors },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get employee stats/dashboard
 * @route   GET /api/employees/stats
 */
exports.getStats = async (req, res, next) => {
    try {
        const totalEmployees = await Employee.countDocuments();
        const activeEmployees = await Employee.countDocuments({ status: 'Active' });
        const inactiveEmployees = await Employee.countDocuments({ status: 'Inactive' });
        const departmentStats = await Employee.aggregate([
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalEmployees,
                activeEmployees,
                inactiveEmployees,
                departmentStats,
            },
        });
    } catch (error) {
        next(error);
    }
};
