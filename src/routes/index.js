const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const employeeRoutes = require('./employeeRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const payrollRoutes = require('./payrollRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const departmentRoutes = require('./departmentRoutes');
const organizationRoutes = require('./organizationRoutes');
const recruitmentRoutes = require('./recruitmentRoutes');
const performanceRoutes = require('./performanceRoutes');
const expenseRoutes = require('./expenseRoutes');
const assetRoutes = require('./assetRoutes');
const supportRoutes = require('./supportRoutes');
const complianceRoutes = require('./complianceRoutes');
const salaryStructureRoutes = require('./salaryStructureRoutes');
const payrollRunRoutes = require('./payrollRunRoutes');
const permissionRoutes = require('./permissionRoutes');
const rolePermissionRoutes = require('./rolePermissionRoutes');
const payrollReportRoutes = require('./payrollReportRoutes');
const payoutRoutes = require('./payoutRoutes');
const notificationRoutes = require('./notificationRoutes');
const statutoryRoutes = require('./statutoryRoutes');
const salaryTemplateRoutes = require('./salaryTemplateRoutes');
const bankRoutes = require('./bankRoutes');
const settingsRoutes = require('./settingsRoutes');
const attendanceConfigRoutes = require('./attendanceConfigRoutes');
const locationRoutes = require('./locationRoutes');
const shiftRoutes = require('./shiftRoutes');
const salaryComponentRoutes = require('./salaryComponentRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);

// FIXED: specific route must come BEFORE general route to avoid conflict
router.use('/payroll/reports', payrollReportRoutes);
router.use('/payroll', payrollRoutes);
router.use('/payouts', payoutRoutes);

router.use('/dashboard', dashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/organization', organizationRoutes);
router.use('/organizations', organizationRoutes); // Alias for plural support
router.use('/recruitment', recruitmentRoutes);
router.use('/performance', performanceRoutes);
router.use('/expenses', expenseRoutes);
router.use('/assets', assetRoutes);
router.use('/support-tickets', supportRoutes);
router.use('/compliance', complianceRoutes);
router.use('/salary-structures', salaryStructureRoutes);
router.use('/payroll-runs', payrollRunRoutes);
router.use('/permissions', permissionRoutes);
router.use('/role-permissions', rolePermissionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/statutory', statutoryRoutes);
router.use('/salary-templates', salaryTemplateRoutes);
router.use('/bank', bankRoutes);
router.use('/settings', settingsRoutes);
router.use('/attendance-config', attendanceConfigRoutes);
router.use('/locations', locationRoutes);
router.use('/shifts', shiftRoutes);
router.use('/salary-components', salaryComponentRoutes);

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Ravi Zoho API is running! 🚀',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

module.exports = router;
