const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const PayrollRun = require('../models/PayrollRun');
const PayoutTransaction = require('../models/PayoutTransaction');
const Attendance = require('../models/Attendance');
const StatutoryConfig = require('../models/StatutoryConfig');
const { calculateSalaryBreakdown } = require('../utils/taxCalculator');
const razorpayService = require('./razorpayService');
const pdfService = require('./pdfService');
const emailService = require('./emailService');

class PayrollAutomationService {
    /**
     * Run the full monthly payroll cycle
     * Can be triggered by CRON or Manual Admin Action
     */
    static async runMonthlyPayroll(month, year, initiatedBy = null) {
        console.log(`🚀 Starting Automated Payroll Cycle for ${month}/${year}...`);
        
        try {
            // 1. INITIATE PAYROLL RUN (Calculations)
            const payrollRun = await this.initiateCalculations(month, year, initiatedBy);
            console.log(`✅ Calculations Complete for ${payrollRun.totalEmployees} employees.`);

            // 2. TRIGGER PAYOUTS (RazorpayX)
            const payoutResults = await this.processPayouts(payrollRun);
            console.log(`💰 Payouts Processed: ${payoutResults.success} success, ${payoutResults.failed} failed.`);

            // 3. GENERATE & EMAIL PAYSLIPS
            const communicationResults = await this.sendPayslips(payrollRun);
            console.log(`📧 Emails Sent: ${communicationResults.success} success, ${communicationResults.failed} failed.`);

            // 4. FINAL STATUS UPDATE
            payrollRun.status = 'paid';
            payrollRun.paidAt = new Date();
            await payrollRun.save();

            return {
                success: true,
                payrollRunId: payrollRun._id,
                stats: {
                    employees: payrollRun.totalEmployees,
                    payouts: payoutResults,
                    emails: communicationResults
                }
            };

        } catch (error) {
            console.error('❌ Critical Payroll Automation Failure:', error);
            // Log to emergency notification channel / Admin dashboard
            throw error;
        }
    }

    /**
     * Step 1: Calculate Salary for all active employees
     */
    static async initiateCalculations(month, year, initiatedBy) {
        // Logic similar to initiatePayrollRun in payrollRunController
        const employees = await Employee.find({ status: 'Active' });
        if (employees.length === 0) throw new Error('No active employees found');

        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(year, month - 1, d).getDay();
            if (day !== 0) workingDays++; // Exclude Sundays
        }

        const config = await StatutoryConfig.findOne({}) || await StatutoryConfig.create({});

        const payrollRun = new PayrollRun({
            month: parseInt(month),
            year: parseInt(year),
            status: 'processing',
            totalEmployees: employees.length,
            initiatedBy
        });

        const payrollRecords = [];
        let totals = { gross: 0, ded: 0, net: 0, pf: 0, esi: 0, pt: 0, lwf: 0, tds: 0, bonus: 0, erPf: 0, erEsi: 0 };

        for (const emp of employees) {
            // Attendance estimation (defaults to full attendance for simplified automation)
            // In a real scenario, this would fetch from Attendance model
            const presentDays = workingDays; 

            const breakdown = calculateSalaryBreakdown(emp, config, workingDays, presentDays);

            const record = await Payroll.create({
                employee: emp._id,
                month,
                year,
                earnings: {
                    ...breakdown.earnings,
                    bonus: breakdown.bonus
                },
                deductions: {
                    pf: breakdown.deductions.pf,
                    esi: breakdown.deductions.esi,
                    tax: breakdown.deductions.tds,
                    professionalTax: breakdown.deductions.professionalTax,
                    lwf: breakdown.deductions.lwf
                },
                totalEarnings: breakdown.grossEarnings + breakdown.bonus,
                totalDeductions: breakdown.totalDeductions,
                netPay: (breakdown.grossEarnings + breakdown.bonus) - breakdown.totalDeductions,
                workingDays,
                presentDays,
                paymentStatus: 'Pending'
            });

            payrollRecords.push(record._id);
            totals.gross += breakdown.grossEarnings;
            totals.ded += breakdown.totalDeductions;
            totals.net += record.netPay;
            totals.pf += breakdown.deductions.pf;
            totals.esi += breakdown.deductions.esi;
            totals.pt += breakdown.deductions.professionalTax;
            totals.lwf += breakdown.deductions.lwf;
            totals.tds += breakdown.deductions.tds;
            totals.bonus += breakdown.bonus;
            totals.erPf += breakdown.employerContributions.pf;
            totals.erEsi += breakdown.employerContributions.esi;
        }

        payrollRun.payrollRecords = payrollRecords;
        payrollRun.totalGrossPay = totals.gross;
        payrollRun.totalDeductions = totals.ded;
        payrollRun.totalNetPay = totals.net;
        payrollRun.totalPF = totals.pf;
        payrollRun.totalESI = totals.esi;
        payrollRun.totalPT = totals.pt;
        payrollRun.totalLWF = totals.lwf;
        payrollRun.totalTDS = totals.tds;
        payrollRun.totalBonus = totals.bonus;
        payrollRun.totalEmployerPF = totals.erPf;
        payrollRun.totalEmployerESI = totals.erEsi;
        
        await payrollRun.save();
        
        // Finalize statutory totals in the run (already done in loop but ensuring consistency)
        return payrollRun;
    }

    /**
     * Step 2: Push to RazorpayX
     */
    static async processPayouts(payrollRun) {
        const records = await Payroll.find({ _id: { $in: payrollRun.payrollRecords } }).populate('employee');
        const transactions = [];

        for (const record of records) {
            const tx = await PayoutTransaction.create({
                employeeId: record.employee._id,
                payrollId: record._id,
                amount: record.netPay,
                currency: 'INR',
                purpose: 'salary',
                status: 'pending'
            });
            transactions.push(tx);
        }

        // Trigger bulk payout via service
        const result = await razorpayService.processBulkPayouts(payrollRun._id, transactions);

        // Update individual payroll record status
        await Payroll.updateMany(
            { _id: { $in: payrollRun.payrollRecords }, paymentStatus: 'Pending' },
            { paymentStatus: 'Processing', paymentMethod: 'RazorpayX' }
        );

        return result;
    }

    /**
     * Step 3: Generate PDFs and Send Emails
     */
    static async sendPayslips(payrollRun) {
        const records = await Payroll.find({ _id: { $in: payrollRun.payrollRecords } }).populate('employee');
        const results = { success: 0, failed: 0 };

        for (const record of records) {
            try {
                // Generate PDF
                const pdfBuffer = await pdfService.generatePayslip(record, record.employee);
                
                // Send Email
                await emailService.sendEmail({
                    to: record.employee.email,
                    subject: `Salary Credited - ${this.getMonthName(record.month)} ${record.year}`,
                    text: `Dear ${record.employee.firstName}, your salary for ${this.getMonthName(record.month)} ${record.year} has been credited. Please find the payslip attached.`,
                    attachments: [
                        {
                            filename: `Payslip_${record.employee.firstName}_${record.month}_${record.year}.pdf`,
                            content: pdfBuffer
                        }
                    ]
                });

                record.paymentStatus = 'Paid';
                record.paymentDate = new Date();
                await record.save();
                
                results.success++;
            } catch (err) {
                console.error(`Failed to send payslip to ${record.employee.email}:`, err);
                results.failed++;
            }
        }
        return results;
    }

    static getMonthName(month) {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return monthNames[month - 1];
    }
}

module.exports = PayrollAutomationService;
