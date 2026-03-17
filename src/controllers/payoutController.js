const RazorpayService = require('../services/razorpayService');
const PayoutTransaction = require('../models/PayoutTransaction');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const BankDetail = require('../models/BankDetail');
const { sendEmail } = require('../services/emailService');

/**
 * Controller to handle Salary Payouts via RazorpayX
 */
class PayoutController {

    /**
     * POST /api/payroll/approve-and-pay
     * Triggers the disbursement flow for an approved payroll
     */
    static async initiatePayout(req, res) {
        try {
            const { payrollId } = req.body;
            
            const payroll = await Payroll.findById(payrollId);
            if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
            
            if (payroll.status !== 'approved') {
                return res.status(400).json({ success: false, message: 'Only approved payrolls can be paid' });
            }

            // Get all records for this payroll
            // Assuming Payroll model has an array of records or we find them in individual PayrollRecords collection
            // For this implementation, we'll fetch from our PayoutTransaction model which should have been initialized
            const transactions = await PayoutTransaction.find({ payrollId, status: 'pending' });

            if (transactions.length === 0) {
                return res.status(400).json({ success: false, message: 'No pending transactions found for this payroll' });
            }

            // Transition payroll to processing
            payroll.status = 'processing';
            await payroll.save();

            // In a production app with 1000+ employees, we would trigger a BullMQ job here
            // But for now, we process them via the service
            const results = await RazorpayService.processBulkPayouts(payrollId, transactions);

            // Update payroll status based on results
            if (results.failed === 0) {
                payroll.status = 'disbursed';
            } else if (results.success > 0) {
                payroll.status = 'partially_disbursed';
            } else {
                payroll.status = 'failed';
            }
            await payroll.save();

            // Notify HR about payroll processing start
            await sendEmail({
                to: process.env.HR_EMAIL || process.env.EMAIL_USER,
                subject: `Payroll Processing Started - ${payrollId}`,
                template: 'notification', // generic template
                data: {
                    title: 'Payroll Processing Started',
                    message: `Disbursement flow for payroll ${payrollId} has been initiated. Success: ${results.success}, Failed: ${results.failed}`
                }
            });

            return res.json({
                success: true,
                message: `Payout initiated. Success: ${results.success}, Failed: ${results.failed}`,
                results
            });
        } catch (error) {
            console.error('Payout Initiation Error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/webhooks/razorpay
     * Handles status updates from Razorpay
     */
    static async handleWebhook(req, res) {
        const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
        // In production, verify the signature here
        
        const { event, payload } = req.body;
        const payout = payload.payout.entity;

        try {
            const transaction = await PayoutTransaction.findOne({ razorpayPayoutId: payout.id });
            if (!transaction) return res.status(404).json({ success: false });

            switch (event) {
                case 'payout.processed':
                    transaction.status = 'processed';
                    transaction.processedAt = new Date();
                    
                    // Notify Employee
                    const empForEmail = await Employee.findById(transaction.employeeId);
                    if (empForEmail) {
                        await sendEmail({
                            to: empForEmail.email,
                            subject: `Salary Credited for ${new Date().toLocaleString('default', { month: 'long' })}`,
                            template: 'payrollProcessed',
                            data: {
                                employeeName: `${empForEmail.firstName} ${empForEmail.lastName}`,
                                month: new Date().toLocaleString('default', { month: 'long' }),
                                salaryAmount: transaction.amount,
                                dashboardUrl: `${process.env.WEBSITE_URL}/dashboard/payroll`
                            }
                        });
                    }
                    break;
                case 'payout.failed':
                    transaction.status = 'failed';
                    transaction.errorMessage = payout.failure_reason;

                    // Notify HR about failure
                    const failedEmp = await Employee.findById(transaction.employeeId);
                    await sendEmail({
                        to: process.env.HR_EMAIL || process.env.EMAIL_USER,
                        subject: `PAYOUT FAILED: ${failedEmp ? failedEmp.firstName : 'Unknown Employee'}`,
                        template: 'notification',
                        data: {
                            title: 'Payout Failed',
                            message: `Payout for ${failedEmp ? failedEmp.firstName : transaction.employeeId} failed. Reason: ${payout.failure_reason}`
                        }
                    });
                    break;
                case 'payout.reversed':
                    transaction.status = 'reversed';
                    break;
                case 'payout.rejected':
                    transaction.status = 'failed';
                    transaction.errorMessage = "Payout rejected by bank/Razorpay";
                    break;
            }

            await transaction.save();
            
            // Log for audit
            console.log(`[Webhook] Payout ${payout.id} status updated to ${transaction.status}`);

            return res.json({ success: true });
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).json({ success: false });
        }
    }

    /**
     * Verification & Setup helper
     * Ensures an employee is "Payout Ready" (Has contact and fund account)
     */
    static async prepareEmployee(req, res) {
        try {
            const { employeeId } = req.params;
            const employee = await Employee.findById(employeeId);
            const bank = await BankDetail.findOne({ employeeId });

            if (!bank) return res.status(404).json({ success: false, message: 'Bank details not found' });

            await RazorpayService.syncContact(employee);
            await RazorpayService.createFundAccount(employee, bank);

            res.json({ success: true, message: 'Employee setup for RazorpayX successful' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = PayoutController;
