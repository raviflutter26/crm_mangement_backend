const nodeCron = require('node-cron');
const LeavePolicy = require('../models/LeavePolicy');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');

/**
 * Monthly Accrual: Credits leaves on the 1st of every month.
 */
const runMonthlyAccrual = async () => {
    console.log('[CRON] Starting Monthly Leave Accrual...');
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();

    try {
        const policies = await LeavePolicy.find({ accrualType: 'monthly', isActive: true, isDeleted: false });

        for (const policy of policies) {
            // Find all employees in this organization
            const employees = await User.find({ organizationId: policy.organizationId, status: 'Active' });

            for (const emp of employees) {
                // Get or create balance
                let balance = await LeaveBalance.findOne({
                    employeeId: emp._id,
                    leaveType: policy.leaveType,
                    year: currentYear
                });

                if (!balance) {
                    balance = new LeaveBalance({
                        employeeId: emp._id,
                        organizationId: policy.organizationId,
                        leaveType: policy.leaveType,
                        year: currentYear,
                        totalEntitled: 0
                    });
                }

                // Credit the monthly amount
                balance.totalEntitled += policy.accrualAmount;
                await balance.save();
            }
        }
        console.log('[CRON] Monthly Leave Accrual completed successfully.');
    } catch (error) {
        console.error('[CRON] Error in Monthly Accrual:', error);
    }
};

/**
 * Schedule the jobs.
 */
const scheduleCronJobs = () => {
    // 1st day of every month at 00:00
    nodeCron.schedule('0 0 1 * *', runMonthlyAccrual);

    // For testing/development: Every Sunday or similar if needed
    // nodeCron.schedule('0 0 * * 0', runMonthlyAccrual); 
};

module.exports = {
    scheduleCronJobs,
    runMonthlyAccrual
};
