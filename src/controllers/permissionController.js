const Permission = require('../models/Permission');
const Employee = require('../models/Employee');
const User = require('../models/User');

/**
 * @desc    Request Permission (Max 2 hours, 4 times/month)
 * @route   POST /api/permissions/request
 */
exports.requestPermission = async (req, res, next) => {
    try {
        const { date, hoursRequest, reason } = req.body;
        
        if (!date || !hoursRequest || !reason) {
            return res.status(400).json({ success: false, message: 'Please provide all details' });
        }

        if (hoursRequest > 2) {
            return res.status(400).json({ success: false, message: 'Maximum 2 hours permission allowed' });
        }

        const employee = await Employee.findOne({ email: req.user.email });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const reqDate = new Date(date);
        const month = reqDate.getMonth() + 1;
        const year = reqDate.getFullYear();

        // Check if employee exceeded 4 times / month
        const countThisMonth = await Permission.countDocuments({
            employee: employee._id,
            month,
            year,
            status: { $in: ['Pending', 'Approved'] }
        });

        if (countThisMonth >= 4) {
            return res.status(400).json({ success: false, message: 'You have reached the limit of 4 permissions this month' });
        }

        // Find manager ID. If reportingManager is available, use it. Else find an admin User.
        let managerId = null;
        if (employee.reportingManager) {
             const managerUser = await User.findOne({ name: employee.reportingManager });
             if (managerUser) managerId = managerUser._id;
        } 
        
        // Fallback to finding any admin if no direct manager is present
        if (!managerId) {
             const adminUser = await User.findOne({ role: 'admin' });
             if (adminUser) managerId = adminUser._id;
        }

        if (!managerId) {
             return res.status(400).json({ success: false, message: 'No manager or admin found to assign this request to' });
        }

        const permission = new Permission({
            employee: employee._id,
            date: reqDate,
            hoursRequest,
            reason,
            month,
            year,
            manager: managerId
        });

        await permission.save();

        res.status(201).json({ success: true, data: permission, message: 'Permission requested successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get permissions for logged in employee
 * @route   GET /api/permissions/my-permissions
 */
exports.getMyPermissions = async (req, res, next) => {
    try {
        const employee = await Employee.findOne({ email: req.user.email });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const permissions = await Permission.find({ employee: employee._id }).sort('-createdAt');
        res.status(200).json({ success: true, data: permissions });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get pending permissions for a manager's team
 * @route   GET /api/permissions/team-permissions
 */
exports.getTeamPermissions = async (req, res, next) => {
    try {
        // If admin, they see all
        let query = {};
        if (req.user.role === 'manager') {
             query.manager = req.user._id;
        }

        const permissions = await Permission.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .sort('-createdAt');
            
        res.status(200).json({ success: true, data: permissions });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Approve or Reject a permission
 * @route   PATCH /api/permissions/:id/approve
 */
exports.handlePermissionStatus = async (req, res, next) => {
    try {
        const { status } = req.body; // 'Approved' or 'Rejected'
        if (!['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const permission = await Permission.findById(req.params.id);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission not found' });

        // Add check if this manager is authorized to approve this, but we'll stick to role check from route
        permission.status = status;
        await permission.save();

        res.status(200).json({ success: true, data: permission, message: `Permission ${status.toLowerCase()} successfully` });
    } catch (error) {
        next(error);
    }
};
