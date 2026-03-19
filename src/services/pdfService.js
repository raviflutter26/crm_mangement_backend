const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class PdfService {
    /**
     * Generate PDF from HTML template
     * @param {string} templateName - Name of the template in src/templates
     * @param {object} data - Data to inject into the template
     * @returns {Buffer} - Generated PDF buffer
     */
    static async generatePdf(templateName, data) {
        let browser;
        try {
            const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
            const templateHtml = await fs.readFile(templatePath, 'utf8');
            
            // Compile handlebars template
            const template = handlebars.compile(templateHtml);
            const html = template(data);

            // Launch puppeteer
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                headless: 'new'
            });

            const page = await browser.newPage();
            
            // Set content and wait for it to be ready
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            return pdfBuffer;
        } catch (error) {
            console.error('PDF Generation Error:', error);
            throw new Error(`Failed to generate PDF: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Generate Payslip PDF
     */
    static async generatePayslip(payrollData, employeeData) {
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        const data = {
            company: {
                name: "Solar CRM Solutions",
                address: "Tech Hub, Electronic City, Bangalore, 560100",
                logo: "https://your-company-logo.com/logo.png"
            },
            employee: {
                id: employeeData.employeeId,
                name: `${employeeData.firstName} ${employeeData.lastName}`,
                designation: employeeData.designation,
                department: employeeData.department,
                pan: employeeData.panNumber,
                bankAccount: employeeData.bankDetails?.accountNumber || 'N/A',
                ifsc: employeeData.bankDetails?.ifscCode || 'N/A',
                joiningDate: employeeData.dateOfJoining ? new Date(employeeData.dateOfJoining).toLocaleDateString() : 'N/A'
            },
            payroll: {
                month: monthNames[payrollData.month - 1],
                year: payrollData.year,
                workingDays: payrollData.workingDays,
                presentDays: payrollData.presentDays,
                leaveDays: payrollData.leaveDays
            },
            earnings: [
                { label: "Basic Pay", amount: payrollData.earnings.basic },
                { label: "HRA", amount: payrollData.earnings.hra },
                { label: "DA", amount: payrollData.earnings.da },
                { label: "Special Allowance", amount: payrollData.earnings.specialAllowance },
                { label: "Statutory Bonus", amount: payrollData.earnings.bonus || 0 }
            ],
            deductions: [
                { label: "Provident Fund (PF)", amount: payrollData.deductions.pf },
                { label: "ESI", amount: payrollData.deductions.esi },
                { label: "Professional Tax (PT)", amount: payrollData.deductions.professionalTax },
                { label: "Labour Welfare Fund (LWF)", amount: payrollData.deductions.lwf || 0 },
                { label: "Income Tax (TDS)", amount: payrollData.deductions.tax }
            ],
            totals: {
                gross: payrollData.totalEarnings,
                deductions: payrollData.totalDeductions,
                net: payrollData.netPay
            }
        };

        return this.generatePdf('payslipTemplate', data);
    }
}

module.exports = PdfService;
