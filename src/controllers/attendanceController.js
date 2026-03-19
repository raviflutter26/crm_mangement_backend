const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const Permission = require('../models/Permission');
const ComplianceSettings = require('../models/ComplianceSettings');
const configService = require('../services/configService');
const zohoPeopleService = require('../services/zohoPeopleService');
const { sendEmail } = require('../services/emailService');
const mongoose = require('mongoose');

/**
 * @desc    Get attendance records
 * @route   GET /api/attendance
 */
exports.getAttendance = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, employee, date, startDate, endDate, status, source } = req.query;

        const query = {};
        
        // Enforce role-based access
        if (req.user) {
            if (req.user.role === 'Employee') {
                const emp = await Employee.findOne({ email: req.user.email });
                if (!emp) return res.status(403).json({ success: false, message: 'Employee profile not found.' });
                query.employee = emp._id;
            } else if (req.user.role === 'Manager') {
                const mgrEmp = await Employee.findOne({ email: req.user.email });
                if (!mgrEmp) return res.status(403).json({ success: false, message: 'Manager profile not found.' });
                
                const allowedEmps = await Employee.find({ 
                    $or: [{ reportingManager: mgrEmp._id }, { _id: mgrEmp._id }] 
                }).select('_id');
                const allowedIds = allowedEmps.map(e => e._id);
                
                // If they explicitly asked for an employee, verify it's in their team
                if (employee) {
                    if (!allowedIds.some(id => id.toString() === employee.toString())) {
                        return res.status(403).json({ success: false, message: 'Unauthorized employee query.' });
                    }
                    query.employee = employee;
                } else {
                    query.employee = { $in: allowedIds };
                }
            } else if (employee) {
                // HR or Admin
                query.employee = employee;
            }
        }
        
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            query.date = { $gte: start, $lt: end };
        }
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        if (status) query.status = status;
        if (source) query.source = source;

        const records = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeId department designation')
            .sort('-date')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Attendance.countDocuments(query);

        res.status(200).json({
            success: true,
            data: records,
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
 * @desc    Biometric/GPS-enabled Check In
 * @route   POST /api/attendance/check-in
 */
exports.checkIn = async (req, res, next) => {
    try {
        const { employeeId, source, latitude, longitude, deviceId, ipAddress } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let record = await Attendance.findOne({ employee: employeeId, date: { $gte: today, $lt: tomorrow } });

        if (record) {
            // Validate against multiple check-ins limits
            if (record.sessions && record.sessions.length > 0) {
                const lastSession = record.sessions[record.sessions.length - 1];
                if (!lastSession.checkOut) {
                    return res.status(400).json({ success: false, message: 'Already checked in. Please check out first.' });
                }
                if (record.sessions.length >= 5) {
                    return res.status(400).json({ success: false, message: 'Maximum of 5 check-ins reached for today.' });
                }
            }
        }

        const checkInTime = new Date();

        // Calculate late mark based on shift & organization
        let lateBy = 0;
        let isLate = false;
        let status = 'Present';

        // Fetch employee details with shift and organization settings
        const employee = await Employee.findById(employeeId).populate('shift').populate('organizationId');
        
        // Define effective settings (Priority: Shift > Organization > Global Default)
        const shift = employee?.shift;
        const orgSettings = employee?.organizationId?.attendanceSettings;
        
        const startTimeStr = shift?.startTime || orgSettings?.defaultStartTime || '09:00';
        const graceMins = shift?.graceMinutes ?? orgSettings?.graceMinutes ?? 15;
        const maxLate = shift?.maxLatePerMonth ?? orgSettings?.maxLatePerMonth ?? 3;

        // Only calculate late marks on the FIRST check-in of the day
        if (!record || record.sessions.length === 0) {
            const [startHour, startMin] = startTimeStr.split(':').map(Number);

            const shiftStart = new Date(today);
            shiftStart.setHours(startHour, startMin, 0, 0);

            const graceThreshold = new Date(shiftStart);
            graceThreshold.setMinutes(graceThreshold.getMinutes() + graceMins);

            // Permission check (Short Leave)
            const approvedPermission = await Permission.findOne({
                employee: employeeId,
                date: today,
                status: 'Approved'
            });

            if (approvedPermission) {
                graceThreshold.setHours(graceThreshold.getHours() + approvedPermission.hoursRequest);
            }

            if (checkInTime > shiftStart) {
                lateBy = Math.round((checkInTime - shiftStart) / 60000);
                if (checkInTime > graceThreshold) {
                    isLate = true;
                }
            }

            if (isLate) {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const lateCount = await Attendance.countDocuments({
                    employee: employeeId,
                    date: { $gte: monthStart, $lt: today },
                    isLate: true
                });

                if (lateCount >= maxLate) {
                    // Penalty: Convert next late to Half Day
                    status = 'Half Day';
                }
            }
            
            // Organization-level cutoff for Absent (if provided)
            if (isLate && orgSettings?.lateAfterGraceAction === 'Absent') {
                status = 'Absent';
            }
        } else {
            // Keep the initial status for subsequent check-ins
            status = record.status;
            lateBy = record.lateBy;
            isLate = record.isLate;
        }

        if (!record) {
            record = new Attendance({
                employee: employeeId,
                date: today,
                checkIn: checkInTime, // keep initial checkIn for legacy reference
                sessions: [{ checkIn: checkInTime }],
                status: status,
                source: source || 'web',
                location: {
                    checkInLat: latitude || null,
                    checkInLng: longitude || null,
                },
                deviceId: deviceId || null,
                ipAddress: ipAddress || req.ip,
                lateBy,
                isLate,
            });
        } else {
            // Append a new session
            record.sessions.push({ checkIn: checkInTime });
            record.status = status; // preserves absent status if already set
            
            // Set first check-in legacy reference if it doesn't exist yet
            if (!record.checkIn) {
                 record.checkIn = checkInTime;
            }
        }

        await record.save();
        
        let message = 'Checked in successfully!';
        if (record.sessions.length === 1) {
             message = status === 'Absent' ? 'Checked in after cutoff limit. Marked as Absent.' : isLate ? `Checked in (${lateBy} min late)` : 'Checked in!';
        }
        
        res.status(200).json({ success: true, data: record, message });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Biometric/GPS-enabled Check Out
 * @route   POST /api/attendance/check-out
 */
exports.checkOut = async (req, res, next) => {
    try {
        const { employeeId, latitude, longitude } = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch employee to get assigned shift
        const employee = await Employee.findById(employeeId).populate('shift').populate('organizationId');
        const shift = employee?.shift;
        const orgSettings = employee?.organizationId?.attendanceSettings;

        let record;
        // Night Shift Logic: If currently early morning, look for yesterday's record
        if (shift?.isNightShift && today.getHours() < 12) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yStart = new Date(yesterday);
            yStart.setHours(0, 0, 0, 0);
            const yEnd = new Date(today);
            yEnd.setHours(0, 0, 0, 0);

            record = await Attendance.findOne({ 
                employee: employeeId, 
                date: { $gte: yStart, $lt: yEnd },
                'sessions.checkOut': null 
            });
        }

        // Fallback to today's record
        if (!record) {
            record = await Attendance.findOne({ 
                employee: employeeId, 
                date: { $gte: today, $lt: tomorrow } 
            });
        }

        if (!record || !record.sessions || record.sessions.length === 0) {
            return res.status(400).json({ success: false, message: 'Must check in first.' });
        }
        
        const lastSession = record.sessions[record.sessions.length - 1];
        if (lastSession.checkOut) {
            return res.status(400).json({ success: false, message: 'No active session found. Already checked out.' });
        }

        const checkOutTime = new Date();
        lastSession.checkOut = checkOutTime;
        lastSession.hours = parseFloat(((checkOutTime - lastSession.checkIn) / (1000 * 60 * 60)).toFixed(2));
        
        // Sum total hours across all sessions
        const sumHours = record.sessions.reduce((acc, curr) => acc + (curr.hours || 0), 0);
        
        // Fetch settings for overtime calculation
        const settingsForOT = await ComplianceSettings.findOne({ isActive: true });
        const stdHours = settingsForOT ? (() => {
            const [sH, sM] = settingsForOT.attendanceSettings.checkInTime.split(':').map(Number);
            const [eH, eM] = settingsForOT.attendanceSettings.checkOutTime.split(':').map(Number);
            return (eH + eM/60) - (sH + sM/60);
        })() : 9;

        record.checkOut = checkOutTime; // track overall last checkout for legacy references
        record.totalHours = parseFloat(sumHours.toFixed(2));
        record.overtime = Math.max(0, parseFloat((record.totalHours - stdHours).toFixed(2)));
        record.effectiveHours = Math.max(0, parseFloat((record.totalHours - (record.breakDuration / 60)).toFixed(2)));
        
        // Use the checkout location for the final or active session
        record.location.checkOutLat = latitude || null;
        record.location.checkOutLng = longitude || null;

        // Strict 6:30 PM checkout rule (only applied if this is the final checkout of day)
        // Note: For multi-sessions, any checkout before 6:30PM will flag them Absent,
        // but if they check back in and check out AFTER 6:30 PM and finish >9 hrs, 
        // they will revert back to 'Present'.
        
        // Final status logic based on Shift/Org settings
        const requiredHours = shift?.workingHours || orgSettings?.workingHours || 8;
        
        // Apply Status Logic:
        // IF totalHours >= requiredHours → Present
        // IF totalHours < requiredHours → Half Day
        
        if (record.totalHours >= requiredHours) {
            if (record.status !== 'Half Day' && record.status !== 'Absent') {
                record.status = 'Present';
            }
        } else {
            record.status = 'Half Day';
        }

        // Check for Early Leave for stats
        const [endHour, endMin] = config.endTime.split(':').map(Number);
        const shiftEnd = new Date(today);
        shiftEnd.setHours(endHour, endMin, 0, 0);

        if (checkOutTime < shiftEnd) {
            record.earlyLeaveBy = Math.round((shiftEnd - checkOutTime) / 60000);
        }

        // Half day detection (override if needed, but per strict rules, they are just Absent if they don't do 9 hours. I will disable Half Day to strictly follow prompt).
        // if (record.totalHours < 4 && record.totalHours > 0) {
        //     record.status = 'Half Day';
        // }

        await record.save();
        res.status(200).json({ success: true, data: record });
    } catch (error) {
        next(error);
    }
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
            const mgrEmp = await Employee.findOne({ email: req.user.email });
            if (mgrEmp) {
                const allowedEmps = await Employee.find({ 
                    $or: [{ reportingManager: mgrEmp._id }, { _id: mgrEmp._id }] 
                }).select('_id');
                const allowedIds = allowedEmps.map(e => e._id);
                userQuery._id = { $in: allowedIds };
                attQuery.employee = { $in: allowedIds };
            }
        }

        const totalEmployees = await Employee.countDocuments(userQuery);
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
        const employee = await Employee.findById(record.employee).populate('reportingManager');
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
                const admins = await Employee.find({ role: { $in: ['Admin', 'HR'] } }).select('email firstName lastName');
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
                const emp = await Employee.findOne({ email: req.user.email });
                if (!emp) return res.status(403).json({ success: false, message: 'Employee profile not found.' });
                matchQuery.employee = emp._id;
            } else if (req.user.role === 'Manager') {
                const mgrEmp = await Employee.findOne({ email: req.user.email });
                if (mgrEmp) {
                    const allowedEmps = await Employee.find({ 
                        $or: [{ reportingManager: mgrEmp._id }, { _id: mgrEmp._id }] 
                    }).select('_id');
                    const allowedIds = allowedEmps.map(e => e._id);
                    matchQuery.employee = { $in: allowedIds };
                }
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
        const populatedReport = await Employee.populate(report, { path: '_id', select: 'firstName lastName employeeId department' });

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
