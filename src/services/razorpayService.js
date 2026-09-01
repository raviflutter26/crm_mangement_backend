const axios = require('axios');
const BankDetail = require('../models/BankDetail');
const PayoutTransaction = require('../models/PayoutTransaction');
const User = require('../models/User');

// Using axios as a fallback if Razorpay SDK isn't available
const RAZORPAYX_BASE_URL = 'https://api.razorpay.com/v1';
const AUTH_HEADER = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');

const razorpayClient = axios.create({
    baseURL: RAZORPAYX_BASE_URL,
    headers: {
        'Authorization': `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/json'
    }
});

/**
 * Service to handle RazorpayX API operations
 */
class RazorpayService {
    
    /**
     * Helper to check if we are in Mock/Demo mode
     */
    static isMockMode() {
        return !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.startsWith('your_') || process.env.RAZORPAY_KEY_ID === 'mock';
    }

    /**
     * Create or update a Razorpay Contact for an employee
     */
    static async syncContact(employee) {
        try {
            const data = {
                name: `${employee.firstName} ${employee.lastName}`,
                email: employee.email,
                contact: employee.phone || "9999999999",
                type: "employee",
                reference_id: employee.employeeId
            };

            if (this.isMockMode()) {
                console.log('[MOCK MODE] Syncing Contact:', data.name);
                const mockId = `cont_${Math.random().toString(36).substr(2, 9)}`;
                employee.razorpayContactId = employee.razorpayContactId || mockId;
                await employee.save();
                return { id: employee.razorpayContactId };
            }

            let response;
            if (employee.razorpayContactId) {
                // Update existing
                response = await razorpayClient.patch(`/contacts/${employee.razorpayContactId}`, data);
            } else {
                // Create new
                response = await razorpayClient.post('/contacts', data);
                employee.razorpayContactId = response.data.id;
                await employee.save();
            }
            return response.data;
        } catch (error) {
            console.error('Razorpay Sync Contact Error:', error.response?.data || error.message);
            throw new Error('Failed to sync contact with RazorpayX');
        }
    }

    /**
     * Link bank account to the Razorpay Contact
     */
    static async createFundAccount(employee, bankDetails) {
        try {
            if (!employee.razorpayContactId) {
                await this.syncContact(employee);
            }

            const data = {
                contact_id: employee.razorpayContactId,
                account_type: "bank_account",
                bank_account: {
                    name: bankDetails.accountHolderName,
                    ifsc: bankDetails.ifscCode,
                    account_number: bankDetails.accountNumber // Uses the virtual getter to decrypt
                }
            };

            if (this.isMockMode()) {
                console.log('[MOCK MODE] Creating Fund Account for:', data.bank_account.name);
                const mockId = `fa_${Math.random().toString(36).substr(2, 9)}`;
                employee.razorpayFundAccountId = mockId;
                await employee.save();
                return { id: mockId };
            }

            const response = await razorpayClient.post('/fund_accounts', data);
            
            // Save fund_account_id to employee for future payouts
            employee.razorpayFundAccountId = response.data.id;
            await employee.save();

            return response.data;
        } catch (error) {
            console.error('Razorpay Create Fund Account Error:', error.response?.data || error.message);
            throw new Error('Failed to link bank account with RazorpayX');
        }
    }

    /**
     * Process a single payout
     */
    static async processPayout(transaction) {
        try {
            const employee = await User.findById(transaction.employeeId);
            if (!employee.razorpayFundAccountId) {
                throw new Error(`Fund account not set for employee ${employee.employeeId}`);
            }

            const data = {
                account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || "mock_account", // Your RazorpayX business account
                fund_account_id: employee.razorpayFundAccountId,
                amount: transaction.amount * 100, // Razorpay uses paise
                currency: "INR",
                mode: transaction.mode || "NEFT",
                purpose: "salary",
                queue_if_low_balance: true,
                reference_id: `PAYROLL_${transaction.payrollId}_${employee.employeeId}`,
                notes: {
                    payroll_id: transaction.payrollId.toString(),
                    employee_id: employee.employeeId
                }
            };

            if (this.isMockMode()) {
                console.log('[MOCK MODE] Processing Payout for amount:', transaction.amount);
                const mockPayoutId = `pout_${Math.random().toString(36).substr(2, 9)}`;
                transaction.razorpayPayoutId = mockPayoutId;
                transaction.status = 'queued'; // In real life, webhooks update this to 'processed'
                transaction.razorpayResponse = { id: mockPayoutId, status: 'queued' };
                await transaction.save();

                // Auto-trigger the webhook success flow in mock mode after 3 seconds to complete the demo flow
                setTimeout(async () => {
                    try {
                        const axios = require('axios');
                        console.log('[MOCK MODE] Auto-triggering webhook success for payout:', mockPayoutId);
                        await axios.post('http://localhost:5001/api/payouts/webhook', {
                            event: 'payout.processed',
                            payload: { payout: { entity: { id: mockPayoutId } } }
                        });
                    } catch (e) {
                        console.error('[MOCK MODE] Auto-webhook failed', e.message);
                    }
                }, 3000);

                return transaction.razorpayResponse;
            }

            const response = await razorpayClient.post('/payouts', data);
            
            transaction.razorpayPayoutId = response.data.id;
            transaction.status = 'queued';
            transaction.razorpayResponse = response.data;
            await transaction.save();

            return response.data;
        } catch (error) {
            transaction.status = 'failed';
            transaction.errorMessage = error.response?.data?.error?.description || error.message;
            await transaction.save();
            throw error;
        }
    }

    /**
     * Bulk process payouts (Scalable Implementation)
     * For 1000+ employees, this should be called by a worker/queue
     */
    static async processBulkPayouts(payrollId, employeeTransactions) {
        const results = { success: 0, failed: 0, errors: [] };
        
        for (const transaction of employeeTransactions) {
            try {
                await this.processPayout(transaction);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    employeeId: transaction.employeeId,
                    error: error.message
                });
            }
        }
        return results;
    }
}

module.exports = RazorpayService;
