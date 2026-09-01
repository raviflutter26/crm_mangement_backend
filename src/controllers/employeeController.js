const User = require('../models/User');
const Organization = require('../models/Organization');
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
        
        // Always filter by organizationId
        if (req.user && req.user.organizationId) {
            query.organizationId = req.user.organizationId;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
            ];
        }
        if (department) {
            query.department = { $regex: department, $options: 'i' };
        }
        if (status) {
            query.status = { $regex: status, $options: 'i' };
        }

        // Role-based filtering for Managers (within their organization)
        if (req.user && req.user.role.toLowerCase() === 'manager') {
            if (req.user.department) {
                query.department = req.user.department;
            } else {
                query.$or = (query.$or || []).concat([
                    { reportingManager: req.user._id },
                    { _id: req.user._id }
                ]);
            }
        }

        const employees = await User.find(query)
            .populate('reportingManager', 'firstName lastName role designation employeeId')
            .populate('shift', 'name startTime endTime')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

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
        const employee = await User.findById(req.params.id)
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

        // 3.5 Enforce the organization's plan employee limit
        const organizationId = req.body.organizationId || req.user?.organizationId;
        if (organizationId) {
            const org = await Organization.findById(organizationId).select('maxEmployees planType');
            if (org && org.maxEmployees) {
                const currentEmployeeCount = await User.countDocuments({ organizationId });
                if (currentEmployeeCount >= org.maxEmployees) {
                    return res.status(400).json({
                        success: false,
                        message: `Employee limit reached for the ${org.planType} plan (${org.maxEmployees} employees). Upgrade the plan to add more employees.`
                    });
                }
            }
        }

        // 3. Create the employee's User record
        const { sendWelcomeEmail: shouldSendWelcomeEmail = true, ...employeeFields } = req.body;
        const newUser = new User({
            ...employeeFields,
            email: email.toLowerCase(),
            panNumber: panNumber.toUpperCase(),
            role: role,
            password: null, // Force null to trigger "Set Password" flow
            isActive: true,
            isFirstLogin: true,
            isPasswordSet: false,
            organizationId: req.body.organizationId || req.user?.organizationId,
        });
        await newUser.save();

        // Audit log
        await logAction(req.user?._id, 'Employee Created', 'Employees', { employeeId: newUser.employeeId, email: newUser.email, pan: newUser.panNumber }, req);

        // 4. Send Welcome Email (unless explicitly opted out)
        if (shouldSendWelcomeEmail !== false) {
            try {
                await sendEmail({
                    to: email,
                    subject: `Welcome to ${process.env.COMPANY_NAME || 'Ravi Zoho HRMS'}!`,
                    template: 'welcomeEmployee',
                    data: {
                        employeeName: `${firstName} ${lastName}`,
                        companyName: process.env.COMPANY_NAME || 'Ravi Zoho HRMS',
                        loginUrl: `${process.env.WEBSITE_URL}/login`,
                        employeeId: newUser.employeeId
                    }
                });
            } catch (emailErr) {
                console.error('Email sending failed during employee creation:', emailErr.message);
            }
        }

        res.status(201).json({ success: true, data: newUser });
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
        const { panNumber } = req.body;

        // 1. Validation for PAN if provided
        if (panNumber) {
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!panRegex.test(panNumber.toUpperCase())) {
                return res.status(400).json({ success: false, message: 'Invalid PAN format. Example: ABCDE1234F' });
            }

            // Check if PAN exists in another record
            const panInUser = await User.findOne({
                panNumber: panNumber.toUpperCase(),
                _id: { $ne: req.params.id }
            });
            if (panInUser) {
                return res.status(400).json({ success: false, message: 'PAN already exists in another employee record.' });
            }
        }

        const employee = await User.findByIdAndUpdate(req.params.id, {
            ...req.body,
            panNumber: panNumber ? panNumber.toUpperCase() : undefined
        }, {
            new: true,
            runValidators: true,
        });

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Audit log
        await logAction(req.user?._id, 'Employee Updated', 'Employees', { id: employee._id, employeeId: employee.employeeId, email: employee.email }, req);

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
        const employee = await User.findByIdAndDelete(req.params.id);
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
        // Find employees who have a manager-level role in the same organization
        const query = {
            role: { $in: ['Admin', 'HR', 'Manager', 'admin', 'hr', 'manager', 'superadmin', 'superadmin'] }
        };
        
        if (req.user && req.user.organizationId) {
            query.organizationId = req.user.organizationId;
        }

        const managers = await User.find(query).select('firstName lastName email role department designation employeeId').sort({ firstName: 1 });

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
        let skipped = 0;

        // Scope synced employees to an organization, and cap new inserts at its plan limit
        // (existing records can still be refreshed). Admin/hr users are scoped to their own
        // org; a superadmin has no organizationId of their own, so it must pass one explicitly
        // to target a specific org (consistent with createEmployee's req.body.organizationId override).
        const organizationId = req.body?.organizationId || req.user?.organizationId;
        let remainingSlots = Infinity;
        if (organizationId) {
            const org = await Organization.findById(organizationId).select('maxEmployees');
            if (org && org.maxEmployees) {
                const currentEmployeeCount = await User.countDocuments({ organizationId });
                remainingSlots = Math.max(org.maxEmployees - currentEmployeeCount, 0);
            }
        }

        // Process Zoho data (shape depends on actual API response)
        if (zohoEmployees && zohoEmployees.response && zohoEmployees.response.result) {
            const records = zohoEmployees.response.result;
            for (const record of records) {
                try {
                    const existing = await User.findOne({ zohoRecordId: record.recordId });
                    if (!existing && remainingSlots <= 0) {
                        skipped++;
                        continue;
                    }

                    await User.findOneAndUpdate(
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
                            organizationId: existing ? existing.organizationId : organizationId,
                            syncedFromZoho: true,
                            lastSyncedAt: new Date(),
                        },
                        { upsert: true, new: true }
                    );
                    if (!existing) remainingSlots--;
                    synced++;
                } catch (err) {
                    errors++;
                    console.error(`Failed to sync employee ${record.EmployeeID}:`, err.message);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: `Sync complete. Synced: ${synced}, Skipped (plan limit reached): ${skipped}, Errors: ${errors}`,
            data: { synced, skipped, errors },
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
        const totalEmployees = await User.countDocuments();
        const activeEmployees = await User.countDocuments({ status: 'Active' });
        const inactiveEmployees = await User.countDocuments({ status: 'Inactive' });
        const departmentStats = await User.aggregate([
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

/**
 * @desc    Update employee bank details
 * @route   PUT /api/employees/:id/bank
 */
exports.updateBankDetails = async (req, res, next) => {
    try {
        const { accountNumber, ifsc, bankName, uan, pan } = req.body;
        const employee = await User.findById(req.params.id);
        
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Update basic employee properties
        if (pan) employee.panNumber = pan.toUpperCase();
        if (uan) {
            employee.statutory = employee.statutory || {};
            employee.statutory.pf = employee.statutory.pf || {};
            employee.statutory.pf.uanNumber = uan;
        }

        // Handle Bank Details (using virtual setter for encryption)
        employee.bankDetails = employee.bankDetails || {};
        if (ifsc) employee.bankDetails.ifscCode = ifsc.toUpperCase();
        if (bankName) employee.bankDetails.bankName = bankName;
        if (accountNumber) employee.bankDetails.accountNumber = accountNumber; // triggers encryption setter

        // Optionally, integrate with RazorpayService here to auto-create fund account
        try {
            const RazorpayService = require('../services/razorpayService');
            if (accountNumber && ifsc) {
                await RazorpayService.createFundAccount(employee, {
                    accountHolderName: employee.fullName,
                    ifscCode: ifsc,
                    accountNumber: accountNumber
                });
            }
        } catch (rpErr) {
            console.error('Auto-sync with Razorpay failed, but bank details were saved', rpErr.message);
        }

        await employee.save();

        await logAction(req.user?._id, 'update_bank', 'Payroll', {
            message: `Bank details updated for ${employee.firstName} ${employee.lastName}`,
            entity: 'User',
            entityId: employee._id.toString(),
        }, req);

        res.status(200).json({ success: true, message: 'Bank details updated successfully', data: employee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update employee salary structure
 * @route   PUT /api/employees/:id/salary-structure
 */
exports.updateSalaryStructure = async (req, res, next) => {
    try {
        const { basic, hra, da, ta, specialAllowance, lta, ctc } = req.body;
        const employee = await User.findById(req.params.id);
        
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        employee.salary = employee.salary || {};
        employee.salary.basic = Number(basic) || 0;
        employee.salary.hra = Number(hra) || 0;
        employee.salary.da = Number(da) || 0;
        employee.salary.ta = Number(ta) || 0;
        employee.salary.specialAllowance = (Number(specialAllowance) || 0) + (Number(lta) || 0);
        employee.ctc = Number(ctc) || (employee.salary.basic + employee.salary.hra + employee.salary.da + employee.salary.ta + employee.salary.specialAllowance);

        // Calculate gross
        employee.salary.grossSalary = employee.salary.basic + employee.salary.hra + employee.salary.da + employee.salary.ta + employee.salary.specialAllowance;

        await employee.save();

        res.status(200).json({ success: true, message: 'Salary structure updated successfully', data: employee });
    } catch (error) {
        next(error);
    }
};
