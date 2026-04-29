const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const JobPosting = require('../models/JobPosting');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard
 */
exports.getDashboard = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let startDate = new Date(today);
        let endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const filter = req.query.filter || 'today';

        if (filter === 'week') {
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
            startDate = new Date(startDate.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        } else if (filter === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (filter === 'year') {
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        const currentMonth = startDate.getMonth() + 1;
        const currentYear = startDate.getFullYear();

        // Check if user is an employee
        if (req.user && req.user.role === 'Employee') {
            const employee = await Employee.findOne({ email: req.user.email })
                .populate('reportingManager', 'firstName lastName email designation');
            
            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee profile not found' });
            }

            // Attendance today
            const attendanceToday = await Attendance.findOne({ employee: employee._id, date: { $gte: today, $lt: tomorrow } });
            
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
                        reportingManager: employee.reportingManager ? 
                            `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}${employee.reportingManager.designation ? ` (${employee.reportingManager.designation})` : ""}` : 'Not Assigned'
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

        // Admin / HR / Manager stats logic
        let employeeQuery = {};
        let attendanceQuery = { date: { $gte: startDate, $lte: endDate } };
        let leaveQuery = {};
        let payrollStatsQuery = filter === 'year' ? { year: currentYear } : { month: currentMonth, year: currentYear };
        let payrollTrendQuery = {};
        let managerDept = null;

        if (req.user && req.user.role === 'Manager') {
            const mgrEmp = await Employee.findOne({ email: req.user.email });
            if (mgrEmp) {
                managerDept = mgrEmp.department;
                // Get all employees in this department
                const departmentEmps = await Employee.find({ department: managerDept }).select('_id');
                const empIdsInDept = departmentEmps.map(e => e._id);
                
                employeeQuery.department = managerDept;
                attendanceQuery.employee = { $in: empIdsInDept };
                leaveQuery.employee = { $in: empIdsInDept };
                payrollStatsQuery.employee = { $in: empIdsInDept };
                payrollTrendQuery.employee = { $in: empIdsInDept };
            }
        }

        const totalEmployees = await Employee.countDocuments(employeeQuery);
        const activeEmployees = await Employee.countDocuments({ ...employeeQuery, status: 'Active' });
        
        console.log(`📊 Dashboard Stats: Total=${totalEmployees}, Active=${activeEmployees}`);
        const newEmployeesThisMonth = await Employee.countDocuments({
            ...employeeQuery,
            createdAt: { $gte: new Date(`${currentYear}-${currentMonth}-01`) },
        });

        // Attendance today/period
        // 'checkedInToday' counts everyone who has any record for today (meaning they checked in)
        const checkedInToday = await Attendance.countDocuments({ 
            ...attendanceQuery, 
            status: { $in: ['Present', 'Half Day', 'WFH', 'Absent'] } 
        });

        // 'presentToday' counts those who are actually marked Present/WFH/HalfDay (on time or allowed)
        // We exclude 'Absent' status which indicates late arrival
        const presentToday = await Attendance.countDocuments({ 
            ...attendanceQuery, 
            status: { $in: ['Present', 'Half Day', 'WFH'] } 
        });

        // Leave stats
        const pendingLeaves = await Leave.countDocuments({ ...leaveQuery, status: 'Pending' });
        const approvedLeavesInPeriod = await Leave.countDocuments({
            ...leaveQuery,
            status: 'Approved',
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
        });
        
        // For Dashboard "On Leave Today" card, show only approved leaves
        const onLeaveToday = approvedLeavesInPeriod;

        // Absent = Total Active - Checked In - Approved Leave Today
        const absentToday = Math.max(0, activeEmployees - checkedInToday - onLeaveToday);

        // Recent activities (Leaves & Hiring)
        const recentLeaves = await Leave.find(leaveQuery)
            .populate('employee', 'firstName lastName')
            .sort('-createdAt')
            .limit(5);
        
        const leaveApprovals = await Leave.find({ ...leaveQuery, status: 'Pending' })
            .populate('employee', 'firstName lastName')
            .sort('createdAt')
            .limit(5);

        const recentHires = await Employee.find({ ...employeeQuery, status: 'Active' })
            .sort('-createdAt')
            .limit(5)
            .select('firstName lastName designation department status createdAt');
            
        const openPositions = await JobPosting.countDocuments({ status: 'Open' });

        // Payroll stats
        const payrollSummary = await Payroll.aggregate([
            { $match: payrollStatsQuery },
            { $group: { _id: null, totalPayroll: { $sum: '$netPay' }, pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Pending'] }, 1, 0] } }, paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] } } } },
        ]);

        // Department distribution
        const departmentDistribution = await Employee.aggregate([
            { $match: { ...employeeQuery, status: 'Active' } },
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        // Trends for charts (Always 7 days for attendance, 6 months for payroll)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Separate query for trends to avoid being restricted by the 'today' filter
        let trendQuery = {};
        if (req.user && req.user.role === 'Manager') {
            const departmentEmps = await Employee.find({ department: managerDept }).select('_id');
            trendQuery.employee = { $in: departmentEmps.map(e => e._id) };
        }

        const attendanceTrends = await Attendance.aggregate([
            { $match: { ...trendQuery, date: { $gte: sevenDaysAgo } } },
            { 
                $group: { 
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, 
                    present: { 
                        $sum: { 
                            $cond: [{ $in: ["$status", ["Present", "Half Day", "WFH", "Absent"]] }, 1, 0] 
                        } 
                    } 
                } 
            },
            { $sort: { _id: 1 } }
        ]);

        const payrollTrends = await Payroll.aggregate([
            { $match: trendQuery },
            { $group: { _id: { month: "$month", year: "$year" }, total: { $sum: "$netPay" } } },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
            { $limit: 12 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                managerDept,
                employees: { total: totalEmployees, active: activeEmployees, newThisMonth: newEmployeesThisMonth },
                attendance: { checkedInToday, presentToday, absentToday, onLeaveToday, attendanceRate: activeEmployees > 0 ? ((checkedInToday / activeEmployees) * 100).toFixed(1) : 0 },
                leaves: { pending: pendingLeaves, onLeaveToday, approved: approvedLeavesInPeriod },
                payroll: payrollSummary[0] || { totalPayroll: 0, pending: 0, paid: 0 },
                departmentDistribution,
                attendanceTrends,
                payrollTrends,
                recentLeaves,
                leaveApprovals,
                recentHires,
                openPositions
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get detailed analytics for the organization
 * @route   GET /api/dashboard/analytics
 */
exports.getAnalytics = async (req, res, next) => {
    try {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        let query = {};
        if (req.user && req.user.role !== 'superadmin' && req.user.organizationId) {
            query.organizationId = req.user.organizationId;
        }

        // 1. KPIs
        const totalEmployees = await Employee.countDocuments(query);
        const activeEmployees = await Employee.countDocuments({ ...query, status: 'Active' });
        
        // Attendance Rate
        const checkedInToday = await Attendance.countDocuments({ 
            ...query, 
            date: { $gte: new Date(today.setHours(0,0,0,0)) },
            status: { $in: ['Present', 'Half Day', 'WFH'] }
        });
        const attendanceRate = activeEmployees > 0 ? ((checkedInToday / activeEmployees) * 100).toFixed(1) : "0";

        // Payroll
        const payrollData = await Payroll.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$netPay' } } }
        ]);
        const totalPayroll = payrollData[0]?.total || 0;

        // 2. Growth (Hiring trends over last 6 months)
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push({
                month: months[d.getMonth()],
                year: d.getFullYear(),
                monthNum: d.getMonth() + 1
            });
        }

        const hiringTrends = await Promise.all(last6Months.map(async (m) => {
            const count = await Employee.countDocuments({
                ...query,
                createdAt: {
                    $gte: new Date(m.year, m.monthNum - 1, 1),
                    $lt: new Date(m.year, m.monthNum, 1)
                }
            });
            return count;
        }));

        // 3. Attendance Trends (Last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
        }

        const attendanceSeries = await Promise.all(Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            d.setHours(0,0,0,0);
            const nextD = new Date(d);
            nextD.setDate(d.getDate() + 1);
            
            return Attendance.countDocuments({
                ...query,
                date: { $gte: d, $lt: nextD },
                status: { $in: ['Present', 'Half Day', 'WFH'] }
            });
        }));

        // 4. Site Distribution
        const locations = await Employee.aggregate([
            { $match: { ...query, status: 'Active' } },
            { $group: { _id: '$location', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const geoDistribution = locations.map(loc => ({
            flag: "📍",
            country: loc._id || "Main Site",
            count: loc.count,
            pct: totalEmployees > 0 ? Math.ceil((loc.count / totalEmployees) * 100) : 0
        }));

        res.status(200).json({
            success: true,
            data: {
                kpis: [
                    { label: "Total Payroll", val: `₹${(totalPayroll / 100000).toFixed(2)}L`, sub: "Total disbursement", delta: "+4.2%", dir: "up", cls: "blue", spark: [30, 45, 35, 55, 48, 62] },
                    { label: "Active Force", val: activeEmployees.toLocaleString(), sub: "On-field team", delta: "+2.1%", dir: "up", cls: "green", spark: [50, 52, 58, 62, 70, 84] },
                    { label: "Attendance Rate", val: `${attendanceRate}%`, sub: "Avg daily presence", delta: "-0.5%", dir: "down", cls: "red", spark: [92, 91, 94, 90, 89, 91] }
                ],
                apiTraffic: {
                    labels: last7Days,
                    series: [
                        { name: "Attendance", color: "var(--primary)", data: attendanceSeries }
                    ]
                },
                growthGrowth: {
                    labels: last6Months.map(m => m.month),
                    series: [
                        { name: "New Hires", color: "var(--primary)", data: hiringTrends }
                    ]
                },
                geoDistribution: geoDistribution.length > 0 ? geoDistribution : [
                    { flag: "📍", country: "Main Office", count: totalEmployees, pct: 100 }
                ]
            }
        });
    } catch (error) {
        next(error);
    }
};
