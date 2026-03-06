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

// Mount routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/organization', organizationRoutes);
router.use('/recruitment', recruitmentRoutes);
router.use('/performance', performanceRoutes);
router.use('/expenses', expenseRoutes);
router.use('/assets', assetRoutes);
router.use('/support-tickets', supportRoutes);
router.use('/compliance', complianceRoutes);
router.use('/salary-structures', salaryStructureRoutes);
router.use('/payroll-runs', payrollRunRoutes);
router.use('/permissions', permissionRoutes);

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
