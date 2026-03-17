const mongoose = require('mongoose');
const User = require('./src/models/User');
const Employee = require('./src/models/Employee');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

async function syncUserDepartments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const employees = await Employee.find({});
        let synced = 0;

        for (const emp of employees) {
            if (emp.email) {
                const updated = await User.findOneAndUpdate(
                    { email: emp.email },
                    { 
                        department: emp.department,
                        designation: emp.designation,
                        role: emp.role // Sync role as well just in case
                    },
                    { new: true }
                );
                if (updated) synced++;
            }
        }

        console.log(`Synced ${synced} users with their employee departments and designations.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

syncUserDepartments();
