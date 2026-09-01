const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Shift = require('../models/Shift');
const Permission = require('../models/Permission');
const ComplianceSettings = require('../models/ComplianceSettings');
const configService = require('../services/configService');
const attendanceConfigService = require('../services/attendanceConfigService');
const permissionService = require('../services/permissionService');
const zohoPeopleService = require('../services/zohoPeopleService');
const { sendEmail } = require('../services/emailService');

/**
 * @desc    Get all attendance records
 * @route   GET /api/attendance
 */
exports.getAttendance = async (req, res, next) => {
    try {
        const { employeeId, startDate, endDate, status } = req.query;
        let query = {};
        const role = (req.user.role || '').toLowerCase();

        // Security: Scoping based on role
        if (employeeId && role === 'superadmin') {
            // Platform-wide access
            query.employee = employeeId;
        } else if (employeeId && ['admin', 'hr', 'manager'].includes(role)) {
            // HR/Admin/Manager explicitly requesting someone specifically — must be within their own organization
            const targetEmployee = await User.findById(employeeId).select('organizationId');
            if (!targetEmployee || String(targetEmployee.organizationId) !== String(req.user.organizationId)) {
                return res.status(403).json({ success: false, message: 'Not authorized to view attendance for this employee' });
            }
            query.employee = employeeId;
        } else if (role === 'employee' || !employeeId) {
            // Default to SELF if no employeeId provided or if role is Employee
            query.employee = req.user._id;
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        if (status) {
            query.status = status;
        }

        const records = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId department')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Biometric/GPS-enabled Check In
 * @route   POST /api/attendance/check-in
 */
exports.checkIn = async (req, res, next) => {
    try {
        let { employeeId, source, latitude, longitude, deviceId, ipAddress } = req.body;

        // Default to self for self-service check-ins
        if (!employeeId || employeeId === req.user.id.toString()) {
            employeeId = req.user._id;
        }

        const employee = await User.findById(employeeId).populate('organizationId');
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

        const organizationId = employee.organizationId?._id;
        if (!organizationId) return res.status(400).json({ success: false, message: 'Organization ID missing from employee profile.' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let record = await Attendance.findOne({ employee: employeeId, date: { $gte: today, $lt: tomorrow } });

        // Security: Check if there is ANY open session (possibly from previous days)
        const openSessionRecord = await Attendance.findOne({ 
            employee: employeeId, 
            "sessions.checkOut": null 
        });

        if (openSessionRecord) {
            return res.status(400).json({ 
                success: false, 
                message: 'Already checked in. Please check out of your previous session first.',
                recordDate: openSessionRecord.date
            });
        }

        const checkInTime = new Date();
        const config = await attendanceConfigService.getEffectiveConfig(organizationId, today);

        // Calculate initial status (will be refined on checkout)
        // For first check-in, we check if they are late
        let isLate = false;
        let lateBy = 0;
        let status = 'Present';

        if (!record || record.sessions.length === 0) {
            const [startHour, startMin] = (config?.startTime || '09:00').split(':').map(Number);
            const shiftStart = new Date(today);
            shiftStart.setHours(startHour, startMin, 0, 0);

            const graceMins = config?.graceMinutes ?? 30;
            const graceThreshold = new Date(shiftStart);
            graceThreshold.setMinutes(graceThreshold.getMinutes() + graceMins);

            // Permission Adjustment
            const monthYear = today.toISOString().slice(0, 7);
            const approvedPermissions = await Permission.find({
                employee: employeeId,
                requestedDate: { $gte: today, $lt: tomorrow },
                status: 'Approved',
                permissionType: 'late_arrival'
            });

            if (approvedPermissions.length > 0) {
                const totalPermMins = approvedPermissions.reduce((acc, p) => acc + p.durationMinutes, 0);
                graceThreshold.setMinutes(graceThreshold.getMinutes() + totalPermMins);
            }

            if (checkInTime > graceThreshold) {
                isLate = true;
                lateBy = Math.round((checkInTime - shiftStart) / 60000);
                
                if (config?.lateAfterGraceAction === 'Absent') status = 'Absent';
                else if (config?.lateAfterGraceAction === 'HalfDay') status = 'Half Day';
            }
        } else {
            status = record.status;
            isLate = record.isLate;
            lateBy = record.lateBy;
        }

        if (!record) {
            record = new Attendance({
                employee: employeeId,
                organizationId,
                date: today,
                checkIn: checkInTime,
                sessions: [{ checkIn: checkInTime }],
                status,
                source: source || 'web',
                location: { checkInLat: latitude || null, checkInLng: longitude || null },
                deviceId,
                ipAddress: ipAddress || req.ip,
                lateBy,
                isLate
            });
        } else {
            record.sessions.push({ checkIn: checkInTime });
        }

        await record.save();
        res.status(200).json({ success: true, data: record, message: 'Checked in!' });
    } catch (error) { next(error); }
};

/**
 * @desc    Biometric/GPS-enabled Check Out
 * @route   POST /api/attendance/checkout
 */
exports.checkOut = async (req, res, next) => {
    try {
        let { employeeId, latitude, longitude } = req.body;
        const targetEmployeeId = employeeId || req.user.id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Try to find today's record first
        let record = await Attendance.findOne({
            employee: targetEmployeeId,
            date: { $gte: today, $lt: tomorrow }
        }).populate('organizationId');

        // If no record for today has an open session, look for the most recent open session from any day
        if (!record || !record.sessions.some(s => !s.checkOut)) {
            const openRecord = await Attendance.findOne({
                employee: targetEmployeeId,
                "sessions.checkOut": null
            }).sort({ date: -1 }).populate('organizationId');

            if (openRecord) record = openRecord;
        }

        if (!record || !record.sessions || record.sessions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Must check in first.'
            });
        }

        // Close ALL open sessions in this record to resolve any orphaned states
        let closedCount = 0;
        const checkOutTime = new Date();
        record.sessions.forEach(session => {
            if (!session.checkOut) {
                session.checkOut = checkOutTime;
                session.hours = parseFloat(((checkOutTime - session.checkIn) / (1000 * 60 * 60)).toFixed(2));
                closedCount++;
            }
        });

        if (closedCount === 0) return res.status(400).json({ success: false, message: 'Already checked out.' });

        const totalHours = record.sessions.reduce((acc, s) => acc + (s.hours || 0), 0);
        record.totalHours = parseFloat(totalHours.toFixed(2));
        record.checkOut = checkOutTime;
        record.location.checkOutLat = latitude || null;
        record.location.checkOutLng = longitude || null;

        // Final Status Calculation from Config
        const config = await attendanceConfigService.getEffectiveConfig(record.organizationId, today);
        if (config) {
            record.status = attendanceConfigService.calculateAttendanceStatus(record.checkIn, checkOutTime, totalHours, config);
        }

        await record.save();
        res.status(200).json({ 
            success: true, 
            data: record, 
            message: `Successfully checked out of ${closedCount} session(s)!` 
        });
    } catch (error) { next(error); }
};

/**
 * @desc    Get today's attendance summary
 * @route   GET /api/attendance/today-summary
 */
exports.getTodaySummary = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // If employee, do not expose stats
        if (req.user && req.user.role === 'Employee') {
            return res.status(200).json({
                success: true,
                data: {
                    totalEmployees: 0, present: 0, absent: 0, onLeave: 0, halfDay: 0, wfh: 0, late: 0, attendancePercentage: 0,
                },
            });
        }
        
        // Base queries — use range to avoid timezone mismatch
        let userQuery = { status: 'Active' };
        let attQuery = { date: { $gte: today, $lt: tomorrow } };

        if (req.user && req.user.role === 'Manager') {
            const allowedEmps = await User.find({
                $or: [{ reportingManager: req.user._id }, { _id: req.user._id }]
            }).select('_id');
            const allowedIds = allowedEmps.map(e => e._id);
            userQuery._id = { $in: allowedIds };
            attQuery.employee = { $in: allowedIds };
        }

        const totalEmployees = await User.countDocuments(userQuery);
        // We count anyone with a record (who checked in) as 'Physically Present' for the dashboard stat
        const present = await Attendance.countDocuments({ 
            ...attQuery, 
            status: { $in: ['Present', 'Half Day', 'WFH', 'Absent'] } 
        });
        const halfDay = await Attendance.countDocuments({ ...attQuery, status: 'Half Day' });
        const wfh = await Attendance.countDocuments({ ...attQuery, status: 'WFH' });
        const onLeave = await Attendance.countDocuments({ ...attQuery, status: 'On Leave' });
        const late = await Attendance.countDocuments({ ...attQuery, isLate: true });
        
        // Absent count for summary: Total employees - those who checked in - those on leave
        // Note: Even if someone is 'Absent' status because of being late, they are 'Present' in the dashboard count
        const absent = totalEmployees - present - onLeave;

        res.status(200).json({
            success: true,
            data: {
                totalEmployees,
                present,
                absent: Math.max(0, absent),
                onLeave,
                halfDay,
                wfh,
                late,
                attendancePercentage: totalEmployees > 0 ? (((present + wfh) / totalEmployees) * 100).toFixed(1) : 0,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Request attendance regularization
 * @route   POST /api/attendance/regularize
 */
exports.requestRegularization = async (req, res, next) => {
    try {
        const { attendanceId, reason } = req.body;
        const record = await Attendance.findById(attendanceId);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });

        record.regularizationStatus = 'pending';
        record.regularizedReason = reason;
        await record.save();

        // Notify for approval
        const employee = await User.findById(record.employee).populate('reportingManager');
        if (employee) {
            if (employee.reportingManager) {
                await sendEmail({
                    to: employee.reportingManager.email,
                    subject: `Attendance Regularization Request - ${employee.firstName} ${employee.lastName}`,
                    template: 'genericNotification', // Assuming a generic template exists or using similar structure
                    data: {
                        recipientName: `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`,
                        message: `${employee.firstName} ${employee.lastName} has requested attendance regularization for ${record.date.toDateString()}. Reason: ${reason}`,
                        actionUrl: `${process.env.WEBSITE_URL}/dashboard/attendance`
                    }
                });
            } else {
                const admins = await User.find({ role: { $in: ['Admin', 'HR'] } }).select('email firstName lastName');
                for (const admin of admins) {
                    await sendEmail({
                        to: admin.email,
                        subject: `[Approval Required] Attendance Regularization - ${employee.firstName} ${employee.lastName}`,
                        template: 'genericNotification',
                        data: {
                            recipientName: `${admin.firstName} ${admin.lastName} (HR/Admin)`,
                            message: `${employee.firstName} ${employee.lastName} has requested attendance regularization for ${record.date.toDateString()}. Reason: ${reason}`,
                            actionUrl: `${process.env.WEBSITE_URL}/dashboard/attendance`
                        }
                    });
                }
            }
        }

        res.status(200).json({ success: true, data: record, message: 'Regularization request submitted.' });
    } catch (error) { next(error); }
};

/**
 * @desc    Approve/reject regularization
 * @route   PATCH /api/attendance/:id/regularize
 */
exports.handleRegularization = async (req, res, next) => {
    try {
        const { status, checkIn, checkOut } = req.body;
        const record = await Attendance.findById(req.params.id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });

        if (status === 'approved') {
            record.regularized = true;
            record.regularizedBy = req.user?._id;
            record.regularizationStatus = 'approved';
            if (checkIn) record.checkIn = new Date(checkIn);
            if (checkOut) {
                record.checkOut = new Date(checkOut);
                record.totalHours = parseFloat(((record.checkOut - record.checkIn) / (1000 * 60 * 60)).toFixed(2));
            }
            record.status = 'Present';
        } else {
            record.regularizationStatus = 'rejected';
        }

        await record.save();
        res.status(200).json({ success: true, data: record, message: `Regularization ${status}.` });
    } catch (error) { next(error); }
};

/**
 * @desc    Monthly attendance report
 * @route   GET /api/attendance/monthly-report
 */
exports.getMonthlyReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const y = parseInt(year) || new Date().getFullYear();

        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0);
        
        const matchQuery = { date: { $gte: startDate, $lte: endDate } };
        
        if (req.user) {
            if (req.user.role === 'Employee') {
                matchQuery.employee = req.user._id;
            } else if (req.user.role === 'Manager') {
                const allowedEmps = await User.find({
                    $or: [{ reportingManager: req.user._id }, { _id: req.user._id }]
                }).select('_id');
                const allowedIds = allowedEmps.map(e => e._id);
                matchQuery.employee = { $in: allowedIds };
            }
        }

        const report = await Attendance.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$employee',
                    totalPresent: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                    totalAbsent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
                    totalHalfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
                    totalWFH: { $sum: { $cond: [{ $eq: ['$status', 'WFH'] }, 1, 0] } },
                    totalLate: { $sum: { $cond: ['$isLate', 1, 0] } },
                    totalHours: { $sum: '$totalHours' },
                    totalOvertime: { $sum: '$overtime' },
                },
            },
            { $sort: { totalPresent: -1 } },
        ]);

        // Populate employee details
        const populatedReport = await User.populate(report, { path: '_id', select: 'firstName lastName employeeId department' });

        res.status(200).json({ success: true, data: populatedReport });
    } catch (error) { next(error); }
};

/**
 * @desc    Sync attendance from Zoho
 * @route   POST /api/attendance/sync
 */
exports.syncFromZoho = async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.body;
        const zohoAttendance = await zohoPeopleService.getAttendance({
            sdate: fromDate,
            edate: toDate,
        });

        res.status(200).json({
            success: true,
            message: 'Attendance sync initiated.',
            data: zohoAttendance,
        });
    } catch (error) {
        next(error);
    }
};
