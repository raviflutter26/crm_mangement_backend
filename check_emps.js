const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Employee = require('./src/models/Employee');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const emps = await Employee.find().select('firstName lastName createdAt status').sort({ createdAt: -1 });
        console.log('Total Employees in DB:', emps.length);
        console.log('Last 5 created employees:');
        emps.slice(0, 5).forEach(e => {
            console.log(`- ${e.firstName} ${e.lastName} | Status: ${e.status} | CreatedAt: ${e.createdAt}`);
        });

        const activeCount = emps.filter(e => e.status === 'Active').length;
        console.log('Active count:', activeCount);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = emps.filter(e => e.createdAt >= startOfMonth).length;
        console.log('New this month:', newThisMonth);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

check();
