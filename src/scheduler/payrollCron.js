const cron = require('node-cron');
const payrollAutomationService = require('../services/payrollAutomationService');

class PayrollScheduler {
    static init() {
        console.log('⏰ Payroll Scheduler Initialized (Monthly on 1st at 9:00 AM)');

        // Cron Format: minute hour day-of-month month day-of-week
        // '0 9 1 * *' -> 1st day of every month at 9:00 AM
        cron.schedule('0 9 1 * *', async () => {
            const now = new Date();
            // Typically payroll is run for the previous month
            let month = now.getMonth(); // 0-indexed, so current month - 1
            let year = now.getFullYear();
            
            if (month === 0) {
                month = 12;
                year -= 1;
            }

            console.log(`📡 [CRON] Triggering Automated Payroll for ${month}/${year}`);
            
            try {
                const result = await payrollAutomationService.runMonthlyPayroll(month, year, 'SYSTEM_CRON');
                console.log('✅ [CRON] Payroll completed successfully:', result.stats);
            } catch (error) {
                console.error('❌ [CRON] Payroll Automation Failed:', error);
                // Potential integration with PagerDuty / Sentry / Admin Email alert
            }
        });

        // Optional: Mid-month check or reminder (15th of the month)
        cron.schedule('0 9 15 * *', () => {
            console.log('⏰ [CRON] Monthly Payroll Reminder: Review employee data for upcoming cycle.');
        });
    }

    /**
     * Helper to manually trigger for testing/debugging
     */
    static async triggerManual(month, year) {
        console.log(`🛠️ [MANUAL] Triggering Payroll for ${month}/${year}`);
        return payrollAutomationService.runMonthlyPayroll(month, year, 'MANUAL_TRIGGER');
    }
}

module.exports = PayrollScheduler;
