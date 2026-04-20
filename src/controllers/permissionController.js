const Permission = require('../models/Permission');
const Employee = require('../models/Employee');
const permissionService = require('../services/permissionService');

/**
 * @desc    Apply for permission
 * @route   POST /api/permissions/request
 */
exports.requestPermission = async (req, res, next) => {
    try {
        const { permissionType, requestedDate, fromTime, toTime, reason } = req.body;
        
        // 1. Identify Employee
        let employeeId = req.user.id;
        if (req.user.role === 'Employee') {
            const emp = await Employee.findOne({ email: req.user.email }).populate('organizationId');
            if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });
            employeeId = emp._id;
            req.orgId = emp.organizationId?._id;
        }

        if (!req.orgId) return res.status(400).json({ success: false, message: 'Organization ID is required.' });

        // 2. Validate using service
        const dateObj = new Date(requestedDate);
        const { durationMinutes, monthYear } = await permissionService.validatePermission(employeeId, req.orgId, {
            fromTime, toTime, requestedDate: dateObj
        });

        // 3. Create Request
        const permission = await Permission.create({
            employee: employeeId,
            organizationId: req.orgId,
            permissionType,
            requestedDate: dateObj,
            fromTime,
            toTime,
            durationMinutes,
            reason,
            monthYear,
            status: 'Pending'
        });

        res.status(201).json({ success: true, data: permission });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get user's permission history & balance
 * @route   GET /api/permissions/my-permissions
 */
exports.getMyPermissions = async (req, res, next) => {
    try {
        const emp = await Employee.findOne({ email: req.user.email });
        if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });

        const history = await Permission.find({ employee: emp._id }).sort({ requestedDate: -1 });
        
        const monthYear = new Date().toISOString().slice(0, 7);
        const usage = await permissionService.getMonthlyUsage(emp._id, monthYear);

        res.status(200).json({ 
            success: true, 
            data: history,
            usage: {
                currentMonth: monthYear,
                usedMinutes: usage.totalMinutes,
                usedCount: usage.totalCount
            }
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Handle (Approve/Reject) permission
 * @route   PATCH /api/permissions/:id/approve
 */
exports.handlePermissionStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        }

        const permission = await Permission.findById(req.params.id);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission request not found.' });

        permission.status = status;
        permission.approvedBy = req.user.id;
        await permission.save();

        res.status(200).json({ success: true, data: permission });
    } catch (error) { next(error); }
};

/**
 * @desc    Get team permissions for manager
 * @route   GET /api/permissions/team-permissions
 */
exports.getTeamPermissions = async (req, res, next) => {
    try {
        let query = {};
        
        // Role-based scoping
        if (req.user.role === 'Manager') {
            const mgrEmp = await Employee.findOne({ email: req.user.email });
            if (mgrEmp) {
                const team = await Employee.find({ reportingManager: mgrEmp._id }).select('_id');
                query.employee = { $in: team.map(e => e._id) };
            }
        } else if (req.user.role === 'Employee') {
            return res.status(200).json({ success: true, data: [] });
        }
        
        if (req.query.employeeId && req.user.role !== 'Employee') {
            query.employee = req.query.employeeId;
        }

        const permissions = await Permission.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .sort({ requestedDate: -1 });

        res.status(200).json({ success: true, count: permissions.length, data: permissions });
    } catch (error) { next(error); }
};

/**
 * @desc    Cancel permission request
 * @route   PATCH /api/permissions/:id/cancel
 */
exports.cancelPermission = async (req, res, next) => {
    try {
        const permission = await Permission.findById(req.params.id);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission not found.' });
        
        const emp = await Employee.findOne({ email: req.user.email });
        if (!emp) return res.status(404).json({ success: false, message: 'Employee profile not found.' });

        if (String(permission.employee) !== String(emp._id)) {
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this request.' });
        }

        if (permission.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Cannot cancel a request with status '${permission.status}'.` });
        }

        permission.status = 'Cancelled';
        await permission.save();

        res.status(200).json({ success: true, message: 'Permission request cancelled.' });
    } catch (error) { next(error); }
};
