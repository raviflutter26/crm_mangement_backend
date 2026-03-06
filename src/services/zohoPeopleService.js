const axios = require('axios');
const config = require('../config');
const zohoAuthService = require('./zohoAuthService');

class ZohoPeopleService {
    /**
     * Make authenticated request to Zoho People API
     */
    async makeRequest(method, endpoint, data = null, params = {}) {
        const token = await zohoAuthService.getAccessToken();
        const url = `${config.zoho.peopleBaseUrl}${endpoint}`;

        try {
            const response = await axios({
                method,
                url,
                data,
                params,
                headers: {
                    Authorization: `Zoho-oauthtoken ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Zoho People API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
            throw error;
        }
    }

    // ============== EMPLOYEE OPERATIONS ==============

    /**
     * Get all employees from Zoho People
     */
    async getEmployees(searchParams = {}) {
        return this.makeRequest('GET', '/forms/P_EmployeeView/records', null, {
            ...searchParams,
        });
    }

    /**
     * Get single employee by record ID
     */
    async getEmployee(recordId) {
        return this.makeRequest('GET', `/forms/P_EmployeeView/records/${recordId}`);
    }

    /**
     * Get employee by employee ID
     */
    async getEmployeeById(employeeId) {
        return this.makeRequest('GET', '/forms/P_EmployeeView/records', null, {
            searchField: 'EmployeeID',
            searchText: employeeId,
        });
    }

    // ============== ATTENDANCE OPERATIONS ==============

    /**
     * Get attendance records
     */
    async getAttendance(params = {}) {
        return this.makeRequest('GET', '/attendance', null, params);
    }

    /**
     * Get attendance for a specific employee
     */
    async getEmployeeAttendance(employeeId, fromDate, toDate) {
        return this.makeRequest('GET', '/attendance', null, {
            empId: employeeId,
            sdate: fromDate,
            edate: toDate,
        });
    }

    /**
     * Check-in for attendance
     */
    async checkIn(employeeId) {
        return this.makeRequest('POST', '/attendance', {
            empId: employeeId,
            checkIn: new Date().toISOString(),
        });
    }

    /**
     * Check-out for attendance
     */
    async checkOut(employeeId) {
        return this.makeRequest('POST', '/attendance', {
            empId: employeeId,
            checkOut: new Date().toISOString(),
        });
    }

    // ============== LEAVE OPERATIONS ==============

    /**
     * Get leave records
     */
    async getLeaves(params = {}) {
        return this.makeRequest('GET', '/forms/P_ApplyLeaveView/records', null, params);
    }

    /**
     * Apply for leave
     */
    async applyLeave(leaveData) {
        return this.makeRequest('POST', '/forms/P_ApplyLeaveView/records', leaveData);
    }

    /**
     * Get leave balance for employee
     */
    async getLeaveBalance(employeeId) {
        return this.makeRequest('GET', '/leave/getLeaveTypeDetails', null, {
            userId: employeeId,
        });
    }

    /**
     * Approve/reject leave
     */
    async updateLeaveStatus(recordId, status, reason = '') {
        return this.makeRequest('PUT', `/forms/P_ApplyLeaveView/records/${recordId}`, {
            ApprovalStatus: status,
            Comments: reason,
        });
    }

    // ============== DEPARTMENT OPERATIONS ==============

    /**
     * Get all departments
     */
    async getDepartments() {
        return this.makeRequest('GET', '/forms/P_Department/records');
    }

    /**
     * Get department by ID
     */
    async getDepartment(recordId) {
        return this.makeRequest('GET', `/forms/P_Department/records/${recordId}`);
    }

    // ============== HOLIDAY OPERATIONS ==============

    /**
     * Get holidays
     */
    async getHolidays(year) {
        return this.makeRequest('GET', '/leave/getHolidays', null, {
            year: year || new Date().getFullYear(),
        });
    }
}

module.exports = new ZohoPeopleService();
