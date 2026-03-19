const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Employee = require('./src/models/Employee');
const Attendance = require('./src/models/Attendance');
const Payroll = require('./src/models/Payroll');
const Leave = require('./src/models/Leave');

async function check() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('Connected!');

        const empCount = await Employee.countDocuments();
        console.log('Total Employees:', empCount);

        const activeEmpCount = await Employee.countDocuments({ status: 'Active' });
        console.log('Active Employees:', activeEmpCount);

        const sampleEmps = await Employee.find().limit(5).select('firstName lastName email');
        console.log('Sample Employees:', JSON.stringify(sampleEmps, null, 2));

        const payrollCount = await Payroll.countDocuments();
        console.log('Total Payroll Records:', payrollCount);

        const leaveCount = await Leave.countDocuments();
        console.log('Total Leave Records:', leaveCount);

        const attendanceCount = await Attendance.countDocuments();
        console.log('Total Attendance Records:', attendanceCount);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
