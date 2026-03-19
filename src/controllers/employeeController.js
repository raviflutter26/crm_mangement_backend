const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const User = require('../models/User');
const zohoPeopleService = require('../services/zohoPeopleService');
const { logAction } = require('../utils/auditLogger');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');

/**
 * @desc    Get all employees
 * @route   GET /api/employees
 */
exports.getEmployees = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 100,
            search,
            department,
            status,
            sort = 'firstName',
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

        // Role-based filtering for Managers
        if (req.user && req.user.role.toLowerCase() === 'manager') {
            const mgrEmp = await Employee.findOne({ email: req.user.email });
            if (mgrEmp && mgrEmp.department) {
                query.department = mgrEmp.department;
            } else if (mgrEmp) {
                query.$or = [
                    { reportingManager: mgrEmp._id },
                    { _id: mgrEmp._id }
                ];
            }
        }

        const employees = await Employee.find(query)
            .populate('reportingManager', 'firstName lastName role designation employeeId')
            .populate('shift', 'name startTime endTime')
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
        const employee = await Employee.findById(req.params.id)
            .populate('reportingManager', 'firstName lastName role designation employeeId')
            .populate('shift', 'name startTime endTime');
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { 
            firstName, lastName, email, phone, role = 'Employee', panNumber, uan, esiNumber, address 
        } = req.body;

        // 1. Mandatory Field Validation
        if (!firstName || !lastName || !email || !panNumber) {
            return res.status(400).json({ success: false, message: 'First Name, Last Name, Email, and PAN Number are required.' });
        }

        // 2. Format & Pattern Validations
        // PAN Number
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(panNumber.toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid PAN format. Example: ABCDE1234F' });
        }

        // Pincode (6 digits)
        if (address?.pincode) {
            if (!/^[0-9]{6}$/.test(address.pincode)) {
                return res.status(400).json({ success: false, message: 'Invalid Pincode. Must be exactly 6 digits.' });
            }
        }

        // UAN (12 digits)
        if (uan) {
            if (!/^[0-9]{12}$/.test(uan)) {
                return res.status(400).json({ success: false, message: 'Invalid UAN. Must be exactly 12 digits.' });
            }
        }

        // ESI (10 to 17 digits)
        if (esiNumber) {
            if (!/^[0-9]{10,17}$/.test(esiNumber)) {
                return res.status(400).json({ success: false, message: 'Invalid ESI Number. Must be 10-17 digits long.' });
            }
        }

        // Phone Number (10 to 12 digits)
        if (phone && !/^[0-9]{10,12}$/.test(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid Phone Number. Must be 10-12 digits.' });
        }

        // 3. Cross-Collection Duplicate Check (Critical)
        const duplicateQuery = { 
            $or: [
                { email: email.toLowerCase() }, 
                { panNumber: panNumber.toUpperCase() }
            ] 
        };
        if (phone) duplicateQuery.$or.push({ phone: phone });

        // Check Users collection
        const userExists = await User.findOne(duplicateQuery);
        if (userExists) {
            let field = 'Email';
            if (userExists.panNumber === panNumber.toUpperCase()) field = 'PAN';
            if (userExists.phone === phone) field = 'Phone';
            return res.status(400).json({ success: false, message: `Employee already exists (${field} matches existing record).` });
        }

        // Check Employees collection
        const employeeExists = await Employee.findOne(duplicateQuery);
        if (employeeExists) {
            let field = 'Email';
            if (employeeExists.panNumber === panNumber.toUpperCase()) field = 'PAN';
            if (employeeExists.phone === phone) field = 'Phone';
            return res.status(400).json({ success: false, message: `Employee already registered (${field} matches existing record).` });
        }

        // 3. Create Employee within transaction
        const employee = new Employee({
            ...req.body,
            email: email.toLowerCase(),
            panNumber: panNumber.toUpperCase()
        });
        await employee.save({ session });

        // 4. Create associated User within transaction
        const userData = {
            name: `${firstName} ${lastName}`,
            email: email.toLowerCase(),
            panNumber: panNumber.toUpperCase(),
            password: null, // Force null to trigger "Set Password" flow
            role: role,
            department: req.body.department || null,
            designation: req.body.designation || null,
            isActive: true,
            isFirstLogin: true
        };

        const newUser = new User(userData);
        await newUser.save({ session });

        // Audit log (outside session but part of flow)
        await logAction(req.user?._id, 'Employee Created', 'Employees', { employeeId: employee.employeeId, email: employee.email, pan: employee.panNumber }, req);

        // 5. Send Welcome Email
        try {
            await sendEmail({
                to: email,
                subject: `Welcome to ${process.env.COMPANY_NAME || 'Ravi Zoho HRMS'}!`,
                template: 'welcomeEmployee',
                data: {
                    employeeName: `${firstName} ${lastName}`,
                    companyName: process.env.COMPANY_NAME || 'Ravi Zoho HRMS',
                    loginUrl: `${process.env.WEBSITE_URL}/login`,
                    employeeId: employee.employeeId
                }
            });
        } catch (emailErr) {
            console.error('Email sending failed during employee creation:', emailErr.message);
            // We don't roll back the whole transaction for email failures
        }

        // 6. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, data: employee });
    } catch (error) {
        // 7. Abort Transaction on failure
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

/**
 * @desc    Update employee
 * @route   PUT /api/employees/:id
 */
exports.updateEmployee = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { role, firstName, lastName, email, panNumber } = req.body;
        
        // 1. Validation for PAN if provided
        if (panNumber) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(panNumber.toUpperCase())) {
                return res.status(400).json({ success: false, message: 'Invalid PAN format. Example: ABCDE1234F' });
            }

            // Check if PAN exists in other records (Employee)
            const panInEmployee = await Employee.findOne({ 
                panNumber: panNumber.toUpperCase(), 
                _id: { $ne: req.params.id } 
            });
            if (panInEmployee) {
                return res.status(400).json({ success: false, message: 'PAN already exists in another employee record.' });
            }

            // Check if PAN exists in other records (User)
            const panInUser = await User.findOne({ 
                panNumber: panNumber.toUpperCase(), 
                email: { $ne: email || (await Employee.findById(req.params.id))?.email } 
            });
            if (panInUser) {
                return res.status(400).json({ success: false, message: 'PAN already exists in another user record.' });
            }
        }

        const employee = await Employee.findByIdAndUpdate(req.params.id, {
            ...req.body,
            panNumber: panNumber ? panNumber.toUpperCase() : undefined
        }, {
            new: true,
            runValidators: true,
            session
        });

        if (!employee) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Sync with User role/name/department if email matches
        if (role || firstName || lastName || req.body.department || req.body.designation || panNumber) {
            let updatePayload = {};
            if (role) updatePayload.role = role;
            if (firstName && lastName) updatePayload.name = `${firstName} ${lastName}`;
            if (req.body.department !== undefined) updatePayload.department = req.body.department;
            if (req.body.designation !== undefined) updatePayload.designation = req.body.designation;
            if (panNumber) updatePayload.panNumber = panNumber.toUpperCase();

            await User.findOneAndUpdate(
                { email: email || employee.email },
                updatePayload,
                { session }
            );
        }

        // Audit log
        await logAction(req.user?._id, 'Employee Updated', 'Employees', { id: employee._id, employeeId: employee.employeeId, email: employee.email }, req);

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, data: employee });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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

        // Audit log
        await logAction(req.user?._id, 'Employee Deleted', 'Employees', { id: req.params.id }, req);

        res.status(200).json({ success: true, message: 'Employee deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get employees who are managers (have a user account with Admin, HR, or Manager role)
 * @route   GET /api/employees/managers
 */
exports.getManagers = async (req, res, next) => {
    try {
        // Find employees who have a manager-level role
        const managers = await Employee.find({
            role: { $in: ['Admin', 'HR', 'Manager'] }
        }).select('firstName lastName email role department designation employeeId').sort({ firstName: 1 });

        res.status(200).json({
            success: true,
            data: managers,
        });
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
