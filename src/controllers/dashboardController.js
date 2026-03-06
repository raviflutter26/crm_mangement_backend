const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard
 */
exports.getDashboard = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // Check if user is an employee
        if (req.user && req.user.role === 'employee') {
            const employee = await Employee.findOne({ email: req.user.email });
            
            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee profile not found' });
            }

            // Attendance today
            const attendanceToday = await Attendance.findOne({ employee: employee._id, date: today });
            
            // Recent Leaves
            const recentLeaves = await Leave.find({ employee: employee._id })
                .sort('-createdAt')
                .limit(5);

            // Pending Leaves Count
            const pendingLeavesCount = await Leave.countDocuments({ employee: employee._id, status: 'Pending' });

            // Leave balance (if we have a leave balance system, for now just returning a mock structured object)
            // TODO: Replace with actual leave balance if available in the model
            const leaveBalance = { casual: 5, sick: 5, earned: 10 };

            return res.status(200).json({
                success: true,
                data: {
                    isEmployee: true,
                    employeeId: employee._id,
                    employeeDetails: {
                        firstName: employee.firstName,
                        lastName: employee.lastName,
                        department: employee.department,
                        designation: employee.designation,
                    },
                    attendanceToday: attendanceToday ? {
                        status: attendanceToday.status,
                        checkIn: attendanceToday.checkIn,
                        checkOut: attendanceToday.checkOut,
                        totalHours: attendanceToday.totalHours,
                        sessions: attendanceToday.sessions || []
                    } : null,
                    recentLeaves,
                    pendingLeavesCount,
                    leaveBalance
                }
            });
        }

        // Admin / HR / Manager stats
        const totalEmployees = await Employee.countDocuments();
        const activeEmployees = await Employee.countDocuments({ status: 'Active' });
        const newEmployeesThisMonth = await Employee.countDocuments({
            createdAt: { $gte: new Date(`${currentYear}-${currentMonth}-01`) },
        });

        // Attendance today
        const presentToday = await Attendance.countDocuments({ date: today, status: 'Present' });
        const absentToday = activeEmployees - presentToday;

        // Leave stats
        const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });
        const onLeaveToday = await Leave.countDocuments({
            status: 'Approved',
            startDate: { $lte: today },
            endDate: { $gte: today },
        });

        // Payroll stats
        const payrollSummary = await Payroll.aggregate([
            { $match: { month: currentMonth, year: currentYear } },
            {
                $group: {
                    _id: null,
                    totalPayroll: { $sum: '$netPay' },
                    pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Pending'] }, 1, 0] } },
                    paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] } },
                },
            },
        ]);

        // Department distribution
        const departmentDistribution = await Employee.aggregate([
            { $match: { status: 'Active' } },
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        // Monthly payroll trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const payrollTrend = await Payroll.aggregate([
            {
                $match: {
                    $or: Array.from({ length: 6 }, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - i);
                        return { month: d.getMonth() + 1, year: d.getFullYear() };
                    }),
                },
            },
            {
                $group: {
                    _id: { month: '$month', year: '$year' },
                    totalPayroll: { $sum: '$netPay' },
                    employeeCount: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        // Recent activities
        const recentLeaves = await Leave.find()
            .populate('employee', 'firstName lastName')
            .sort('-createdAt')
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                employees: {
                    total: totalEmployees,
                    active: activeEmployees,
                    newThisMonth: newEmployeesThisMonth,
                },
                attendance: {
                    presentToday,
                    absentToday,
                    onLeaveToday,
                    attendanceRate: activeEmployees > 0
                        ? ((presentToday / activeEmployees) * 100).toFixed(1)
                        : 0,
                },
                leaves: {
                    pending: pendingLeaves,
                    onLeaveToday,
                },
                payroll: payrollSummary[0] || { totalPayroll: 0, pending: 0, paid: 0 },
                departmentDistribution,
                payrollTrend,
                recentLeaves,
            },
        });
    } catch (error) {
        next(error);
    }
};
