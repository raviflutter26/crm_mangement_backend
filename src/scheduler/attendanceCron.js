const cron = require('node-cron');
const { runMonthlyAccrual } = require('../utils/cronJobs');

class AttendanceScheduler {
    static init() {
        console.log('⏰ Attendance & Leave Scheduler Initialized');

        // Monthly Leave Accrual: 1st day of every month at 00:00 AM
        cron.schedule('0 0 1 * *', async () => {
            console.log('📡 [CRON] Triggering Monthly Leave Accrual');
            try {
                await runMonthlyAccrual();
                console.log('✅ [CRON] Leave Accrual completed successfully.');
            } catch (error) {
                console.error('❌ [CRON] Leave Accrual Failed:', error);
            }
        });
    }
}

module.exports = AttendanceScheduler;
