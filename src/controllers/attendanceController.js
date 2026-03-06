const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const Permission = require('../models/Permission');
const zohoPeopleService = require('../services/zohoPeopleService');

/**
 * @desc    Get attendance records
 * @route   GET /api/attendance
 */
exports.getAttendance = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, employee, date, startDate, endDate, status, source } = req.query;

        const query = {};
        if (employee) query.employee = employee;
        if (date) query.date = new Date(date);
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
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

        let record = await Attendance.findOne({ employee: employeeId, date: today });

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

        // Calculate late mark based on shift & permission
        let lateBy = 0;
        let isLate = false;
        let status = 'Present';

        // Only calculate late marks on the FIRST check-in of the day
        if (!record || record.sessions.length === 0) {
            const shiftStart = new Date(today);
            shiftStart.setHours(9, 30, 0, 0);

            const absoluteLatestCheckIn = new Date(today);
            absoluteLatestCheckIn.setHours(10, 1, 0, 0); // 10:01 AM

            const approvedPermission = await Permission.findOne({
                employee: employeeId,
                date: today,
                status: 'Approved'
            });

            if (approvedPermission) {
                absoluteLatestCheckIn.setHours(absoluteLatestCheckIn.getHours() + approvedPermission.hoursRequest);
            }

            if (checkInTime > shiftStart) {
                lateBy = Math.round((checkInTime - shiftStart) / 60000);
                isLate = true;
            }

            if (checkInTime > absoluteLatestCheckIn) {
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

        const record = await Attendance.findOne({ employee: employeeId, date: today });

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
        
        record.checkOut = checkOutTime; // track overall last checkout for legacy references
        record.totalHours = parseFloat(sumHours.toFixed(2));
        record.overtime = Math.max(0, parseFloat((record.totalHours - 9).toFixed(2)));
        record.effectiveHours = Math.max(0, parseFloat((record.totalHours - (record.breakDuration / 60)).toFixed(2)));
        
        // Use the checkout location for the final or active session
        record.location.checkOutLat = latitude || null;
        record.location.checkOutLng = longitude || null;

        // Strict 6:30 PM checkout rule (only applied if this is the final checkout of day)
        // Note: For multi-sessions, any checkout before 6:30PM will flag them Absent,
        // but if they check back in and check out AFTER 6:30 PM and finish >9 hrs, 
        // they will revert back to 'Present'.
        
        const shiftEnd = new Date(today);
        shiftEnd.setHours(18, 30, 0, 0); // 6:30 PM
        
        // Permission check
        const approvedPermission = await Permission.findOne({
            employee: employeeId,
            date: today,
            status: 'Approved'
        });

        if (approvedPermission) {
            shiftEnd.setHours(shiftEnd.getHours() - approvedPermission.hoursRequest);
        }

        const requiredHours = approvedPermission ? (9 - approvedPermission.hoursRequest) : 9;

        // If they checked in late (marked Absent), they generally stay Absent. Follow initial rules.
        // We only override to Present if they fixed criteria, or Absent if they fail criteria.
        if (checkOutTime < shiftEnd) {
            record.earlyLeaveBy = Math.round((shiftEnd - checkOutTime) / 60000);
            record.status = 'Absent'; 
        } else if (record.totalHours < requiredHours) {
            record.status = 'Absent'; 
        } else if (record.status !== 'Absent') {
            // Keep present if not already marked absent at 10:01 AM check-in
            record.status = 'Present';
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

        const totalEmployees = await Employee.countDocuments({ status: 'Active' });
        const present = await Attendance.countDocuments({ date: today, status: 'Present' });
        const halfDay = await Attendance.countDocuments({ date: today, status: 'Half Day' });
        const wfh = await Attendance.countDocuments({ date: today, status: 'WFH' });
        const onLeave = await Attendance.countDocuments({ date: today, status: 'On Leave' });
        const late = await Attendance.countDocuments({ date: today, isLate: true });
        const absent = totalEmployees - present - halfDay - wfh - onLeave;

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

        const report = await Attendance.aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
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
