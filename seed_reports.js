const mongoose = require('mongoose');
const PayrollReport = require('./src/models/PayrollReport');
require('dotenv').config();

const reports = [
    {
        reportName: "Payroll Summary - Jan 2026",
        reportType: "pdf",
        reportCategory: "Payroll Overview",
        month: 1,
        year: 2026,
        department: "All",
        status: "Generated",
        fileUrl: "https://example.com/reports/jan-2026.pdf"
    },
    {
        reportName: "Salary Register - Feb 2026",
        reportType: "excel",
        reportCategory: "Payroll Overview",
        month: 2,
        year: 2026,
        department: "Engineering",
        status: "Generated",
        fileUrl: "https://example.com/reports/feb-2026.xlsx"
    },
    {
        reportName: "PF Summary - Q4 2025",
        reportType: "pdf",
        reportCategory: "Statutory Reports",
        month: 12,
        year: 2025,
        department: "All",
        status: "Generated",
        fileUrl: "https://example.com/reports/pf-q4-2025.pdf"
    }
];

const seedReports = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB for seeding reports...");
        
        // Find an admin user to assign as generator
        const User = mongoose.model('User');
        const admin = await User.findOne({ role: 'Admin' });
        
        if (!admin) {
            console.error("No Admin user found. Please run main seed first.");
            process.exit(1);
        }

        const reportsWithUser = reports.map(r => ({ ...r, generatedBy: admin._id }));

        await PayrollReport.deleteMany({});
        await PayrollReport.insertMany(reportsWithUser);
        
        console.log("Payroll Reports seeded! ✅");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
};

seedReports();
