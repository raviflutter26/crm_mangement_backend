const LeavePolicy = require('../models/LeavePolicy');
const LeaveBalance = require('../models/LeaveBalance');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');

/**
 * Calculate total working days between two dates, excluding weekends and public holidays.
 */
const calculateWorkingDays = async (organizationId, fromDate, toDate) => {
    let count = 0;
    let current = new Date(fromDate);
    const end = new Date(toDate);

    // Fetch holidays for the org/year
    const holidays = await Holiday.find({
        organizationId,
        date: { $gte: fromDate, $lte: toDate }
    });
    const holidayDates = holidays.map(h => h.date.toISOString().split('T')[0]);

    while (current <= end) {
        const day = current.getDay();
        const dateStr = current.toISOString().split('T')[0];

        // 0 = Sunday, 6 = Saturday (Assumes Sat/Sun are weekends)
        const isWeekend = (day === 0 || day === 6);
        const isHoliday = holidayDates.includes(dateStr);

        if (!isWeekend && !isHoliday) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

/**
 * Get dynamic leave balance for an employee.
 */
const getLeaveBalance = async (employeeId, organizationId, leaveType, year) => {
    let balance = await LeaveBalance.findOne({ employeeId, leaveType, year });
    
    if (!balance) {
        // Initialize from policy if missing
        const policy = await LeavePolicy.findOne({ organizationId, leaveType, isActive: true });
        if (policy) {
            balance = await LeaveBalance.create({
                employeeId,
                organizationId,
                leaveType,
                year,
                totalEntitled: policy.accrualType === 'upfront' ? policy.daysPerYear : 0
            });
        }
    }
    
    return balance;
};

/**
 * Validate leave request against policy.
 */
const validateLeaveRequest = async (employeeId, organizationId, requestData, employee) => {
    const { leaveType, fromDate, toDate } = requestData;
    const year = new Date(fromDate).getFullYear();

    // 1. Get Policy
    const policy = await LeavePolicy.findOne({
        organizationId,
        leaveType,
        isActive: true
    }).sort({ createdAt: -1 });

    if (!policy) throw new Error("Leave policy not found for this type.");

    // 2. Probation Check
    const joiningDate = new Date(employee.dateOfJoining);
    const daysSinceJoining = Math.floor((new Date(fromDate) - joiningDate) / (1000 * 60 * 60 * 24));
    if (daysSinceJoining < policy.applicableAfterDays) {
        throw new Error(`Policy applicable only after ${policy.applicableAfterDays} days of joining. (Current: ${daysSinceJoining})`);
    }

    // 3. Gender Check
    if (policy.genderSpecific && employee.gender !== policy.genderSpecific) {
        throw new Error(`This leave is only applicable for ${policy.genderSpecific} employees.`);
    }

    // 4. Working Days calculation
    const totalDays = await calculateWorkingDays(organizationId, new Date(fromDate), new Date(toDate));
    if (totalDays === 0) throw new Error("Range consists only of weekends or holidays.");
    if (totalDays > policy.maxConsecutiveDays) {
        throw new Error(`Maximum consecutive days allowed is ${policy.maxConsecutiveDays}.`);
    }

    // 5. Balance check
    const balance = await getLeaveBalance(employeeId, organizationId, leaveType, year);
    if (!balance) throw new Error("No leave balance record found.");
    
    if (balance.remaining < totalDays) {
        throw new Error(`Insufficient balance. Requested: ${totalDays}, Available: ${balance.remaining}`);
    }

    // 6. Notice Period
    const noticeDays = Math.floor((new Date(fromDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (noticeDays < policy.minDaysNotice) {
        throw new Error(`Minimum ${policy.minDaysNotice} days notice required for this leave.`);
    }

    return { totalDays, policy, balance };
};

module.exports = {
    calculateWorkingDays,
    getLeaveBalance,
    validateLeaveRequest
};
