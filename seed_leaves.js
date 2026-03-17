const mongoose = require('mongoose');
const Leave = require('./src/models/Leave');
const Employee = require('./src/models/Employee');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

async function seedLeaves() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const employees = await Employee.find({});
        console.log(`Found ${employees.length} employees to seed leaves.`);

        let recordsCreated = 0;

        for (const emp of employees) {
            // Give every employee 1 or 2 past leave records for February
            const leave1 = new Leave({
                employee: emp._id,
                leaveType: 'Sick Leave',
                startDate: new Date('2026-02-10T00:00:00.000Z'),
                endDate: new Date('2026-02-11T00:00:00.000Z'),
                totalDays: 2,
                reason: 'Fever and cold',
                status: 'Approved'
            });

            const leave2 = new Leave({
                employee: emp._id,
                leaveType: 'Casual Leave',
                startDate: new Date('2026-02-25T00:00:00.000Z'),
                endDate: new Date('2026-02-25T00:00:00.000Z'),
                totalDays: 1,
                reason: 'Personal work',
                status: 'Approved'
            });

            const leave3 = new Leave({
                employee: emp._id,
                leaveType: 'Earned Leave',
                startDate: new Date('2026-03-20T00:00:00.000Z'),
                endDate: new Date('2026-03-22T00:00:00.000Z'),
                totalDays: 3,
                reason: 'Family trip',
                status: 'Pending'
            });

            // Prevent duplicate seeding by clearing old leaves first if any
            await Leave.deleteMany({ employee: emp._id });

            await leave1.save();
            await leave2.save();
            await leave3.save();
            recordsCreated += 3;
        }

        console.log(`Successfully generated ${recordsCreated} mock leave requests.`);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedLeaves();
