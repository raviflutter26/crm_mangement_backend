const RazorpayService = require('../services/razorpayService');
const PayoutTransaction = require('../models/PayoutTransaction');
const Payroll = require('../models/Payroll');
const PayrollRun = require('../models/PayrollRun');
const User = require('../models/User');
const BankDetail = require('../models/BankDetail');
const { sendEmail } = require('../services/emailService');
const { logAction } = require('../utils/auditLogger');

/**
 * Payout transactions have no organizationId of their own — scope them via
 * the Payroll records that belong to the requester's organization.
 */
async function orgScopedPayrollIds(orgId) {
    const payrolls = await Payroll.find({ organizationId: orgId }).select('_id');
    return payrolls.map(p => p._id);
}

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
                if (run.status !== 'locked') {
                    return res.status(400).json({ success: false, message: 'Payroll run must be locked before disbursement' });
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

            await logAction(req.user?._id, 'disburse', 'Payroll', {
                message: `Disbursement triggered for ${pendingTransactions.length} record(s)${runId ? ` (run ${runId})` : ''}. Success: ${results.success}, Failed: ${results.failed}`,
                entity: runId ? 'PayrollRun' : 'Payroll',
                entityId: runId || payrollId,
            }, req);

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
     * GET /api/payouts/status
     * Summary counts of payout transactions for the requester's organization
     */
    static async getStatus(req, res) {
        try {
            const orgId = req.user?.organizationId;
            const payrollIds = await orgScopedPayrollIds(orgId);
            const transactions = await PayoutTransaction.find({ payrollId: { $in: payrollIds } });

            const summary = {
                total: transactions.length,
                pending: transactions.filter(t => t.status === 'pending' || t.status === 'queued').length,
                processing: transactions.filter(t => t.status === 'processing').length,
                processed: transactions.filter(t => t.status === 'processed' || t.status === 'processed_at_bank').length,
                failed: transactions.filter(t => t.status === 'failed').length,
            };

            res.json({ success: true, data: summary });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * GET /api/payouts/history
     * Full transaction list for the requester's organization
     */
    static async getHistory(req, res) {
        try {
            const orgId = req.user?.organizationId;
            const payrollIds = await orgScopedPayrollIds(orgId);
            const transactions = await PayoutTransaction.find({ payrollId: { $in: payrollIds } })
                .populate('employeeId', 'firstName lastName employeeId')
                .sort('-createdAt');

            const data = transactions.map(t => ({
                _id: t._id,
                employeeName: t.employeeId ? `${t.employeeId.firstName || ''} ${t.employeeId.lastName || ''}`.trim() : undefined,
                employeeId: t.employeeId?.employeeId,
                amount: t.amount,
                razorpayPayoutId: t.razorpayPayoutId,
                status: t.status,
                mode: t.mode,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                failureReason: t.errorMessage,
            }));

            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * POST /api/payouts/:id/retry
     * Re-attempt a failed payout transaction
     */
    static async retryPayout(req, res) {
        try {
            const orgId = req.user?.organizationId;
            const payrollIds = await orgScopedPayrollIds(orgId);
            const transaction = await PayoutTransaction.findOne({ _id: req.params.id, payrollId: { $in: payrollIds } });
            if (!transaction) return res.status(404).json({ success: false, message: 'Payout transaction not found' });
            if (transaction.status !== 'failed') {
                return res.status(400).json({ success: false, message: 'Only failed payouts can be retried' });
            }

            transaction.status = 'pending';
            transaction.errorMessage = undefined;
            await transaction.save();

            try {
                await RazorpayService.processPayout(transaction);
            } catch (payoutError) {
                // processPayout already persists the failure status/message on the transaction
                await logAction(req.user?._id, 'retry_payout', 'Payroll', {
                    message: `Retry failed for payout ${transaction._id}: ${payoutError.message}`,
                    entity: 'PayoutTransaction',
                    entityId: transaction._id.toString(),
                    status: 'failure',
                }, req);
                return res.status(400).json({ success: false, message: payoutError.message });
            }

            await logAction(req.user?._id, 'retry_payout', 'Payroll', {
                message: `Retry initiated for payout ${transaction._id}`,
                entity: 'PayoutTransaction',
                entityId: transaction._id.toString(),
            }, req);

            res.json({ success: true, data: transaction });
        } catch (error) {
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
                    const empForEmail = await User.findById(transaction.employeeId);
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
                    const failedEmp = await User.findById(transaction.employeeId);
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
            const employee = await User.findById(employeeId);
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
