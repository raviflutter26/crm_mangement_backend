const RazorpayService = require('../services/razorpayService');
const PayoutTransaction = require('../models/PayoutTransaction');
const Payroll = require('../models/Payroll');
const PayrollRun = require('../models/PayrollRun');
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
            const { payrollId, runId } = req.body;
            let payrollToPay = [];

            if (runId) {
                // Process the whole run
                const run = await PayrollRun.findById(runId).populate('payrollRecords');
                if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
                if (run.status !== 'approved') {
                    return res.status(400).json({ success: false, message: 'Only approved payroll runs can be paid' });
                }
                
                // Get individual payroll documents from the run
                payrollToPay = await Payroll.find({ _id: { $in: run.payrollRecords }, paymentStatus: 'Pending' });
                
                if (payrollToPay.length === 0) {
                    return res.status(400).json({ success: false, message: 'No pending payroll records found in this run' });
                }

                // Update run status to paid (or processing if using worker)
                run.status = 'paid';
                run.paidAt = new Date();
                await run.save();
            } else if (payrollId) {
                // Process individual record
                const individualPayroll = await Payroll.findById(payrollId);
                if (!individualPayroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
                if (individualPayroll.paymentStatus === 'Paid') {
                    return res.status(400).json({ success: false, message: 'Payroll already paid' });
                }
                payrollToPay = [individualPayroll];
            } else {
                return res.status(400).json({ success: false, message: 'payrollId or runId required' });
            }

            // For each payroll record, ensure a PayoutTransaction exists
            for (const payroll of payrollToPay) {
                let transaction = await PayoutTransaction.findOne({ payrollId: payroll._id });
                if (!transaction) {
                    transaction = await PayoutTransaction.create({
                        payrollId: payroll._id,
                        employeeId: payroll.employee,
                        amount: payroll.netPay,
                        status: 'pending'
                    });
                }
            }

            // Get pending transactions to process
            const pendingTransactions = await PayoutTransaction.find({ 
                payrollId: { $in: payrollToPay.map(p => p._id) }, 
                status: 'pending' 
            });

            if (pendingTransactions.length === 0) {
                return res.status(400).json({ success: false, message: 'All transactions for this payroll/run are already processed or failed' });
            }

            // Trigger RazorpayX Bulk process
            const results = await RazorpayService.processBulkPayouts(runId || payrollId, pendingTransactions);

            // Update individual payroll record statuses
            await Payroll.updateMany(
                { _id: { $in: payrollToPay.map(p => p._id) } },
                { paymentStatus: 'Paid', paymentDate: new Date() }
            );

            // Notify HR
            await sendEmail({
                to: process.env.HR_EMAIL || process.env.EMAIL_USER,
                subject: runId ? `Payroll Run Disbursed - ${runId}` : `Individual Payroll Disbursed - ${payrollId}`,
                template: 'notification',
                data: {
                    title: 'Payroll Disbursement Initiated',
                    message: `RazorpayX disbursement flow has been triggered. Success: ${results.success}, Failed: ${results.failed}`
                }
            });

            return res.json({
                success: true,
                message: `Payout initiated for ${pendingTransactions.length} records.`,
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
