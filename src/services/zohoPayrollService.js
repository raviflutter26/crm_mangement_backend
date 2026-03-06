const axios = require('axios');
const config = require('../config');
const zohoAuthService = require('./zohoAuthService');

class ZohoPayrollService {
    /**
     * Make authenticated request to Zoho Payroll API
     */
    async makeRequest(method, endpoint, data = null, params = {}) {
        const token = await zohoAuthService.getAccessToken();
        const url = `${config.zoho.payrollBaseUrl}${endpoint}`;

        try {
            const response = await axios({
                method,
                url,
                data,
                params: {
                    ...params,
                    organization_id: config.zoho.orgId,
                },
                headers: {
                    Authorization: `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Zoho Payroll API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
            throw error;
        }
    }

    // ============== EMPLOYEE PAYROLL OPERATIONS ==============

    /**
     * Get employee payroll details
     */
    async getEmployeePayroll(employeeId) {
        return this.makeRequest('GET', `/employees/${employeeId}`);
    }

    /**
     * Get all employees in payroll
     */
    async getPayrollEmployees(params = {}) {
        return this.makeRequest('GET', '/employees', null, params);
    }

    // ============== PAY RUN OPERATIONS ==============

    /**
     * Get all pay runs
     */
    async getPayRuns(params = {}) {
        return this.makeRequest('GET', '/payruns', null, params);
    }

    /**
     * Get pay run details
     */
    async getPayRun(payRunId) {
        return this.makeRequest('GET', `/payruns/${payRunId}`);
    }

    /**
     * Get pay run employees
     */
    async getPayRunEmployees(payRunId) {
        return this.makeRequest('GET', `/payruns/${payRunId}/employees`);
    }

    // ============== PAYSLIP OPERATIONS ==============

    /**
     * Get payslip for employee
     */
    async getPayslip(employeeId, payRunId) {
        return this.makeRequest('GET', `/employees/${employeeId}/payruns/${payRunId}/payslip`);
    }

    /**
     * Get all payslips for employee
     */
    async getEmployeePayslips(employeeId, params = {}) {
        return this.makeRequest('GET', `/employees/${employeeId}/payslips`, null, params);
    }

    // ============== SALARY COMPONENTS ==============

    /**
     * Get salary components
     */
    async getSalaryComponents() {
        return this.makeRequest('GET', '/salarycomponents');
    }

    /**
     * Get employee salary structure
     */
    async getEmployeeSalaryStructure(employeeId) {
        return this.makeRequest('GET', `/employees/${employeeId}/salarystructure`);
    }

    // ============== TAX OPERATIONS ==============

    /**
     * Get employee tax details
     */
    async getEmployeeTaxDetails(employeeId) {
        return this.makeRequest('GET', `/employees/${employeeId}/incometaxstatement`);
    }

    // ============== REIMBURSEMENT OPERATIONS ==============

    /**
     * Get reimbursement claims
     */
    async getReimbursements(params = {}) {
        return this.makeRequest('GET', '/reimbursements', null, params);
    }

    /**
     * Submit reimbursement claim
     */
    async submitReimbursement(data) {
        return this.makeRequest('POST', '/reimbursements', data);
    }
}

module.exports = new ZohoPayrollService();
