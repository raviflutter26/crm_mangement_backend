const mongoose = require('mongoose');
require('dotenv').config();
const Attendance = require('./src/models/Attendance');
const Employee = require('./src/models/Employee');
const User = require('./src/models/User');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const users = await User.find({ email: /ravi/i });
        console.log('Users found:', users.map(u => ({ id: u._id, email: u.email, role: u.role })));

        const emps = await Employee.find({ email: /ravi/i });
        console.log('Employees found:', emps.map(e => ({ id: e._id, email: e.email, firstName: e.firstName })));

        const records = await Attendance.find({}).sort({ createdAt: -1 }).limit(10);
        console.log('Recent Attendance Records:', records.map(r => ({
            id: r._id,
            employee: r.employee,
            date: r.date,
            sessions: r.sessions.map(s => ({ checkIn: s.checkIn, checkOut: s.checkOut }))
        })));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
