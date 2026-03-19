const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('./src/models/Employee');
const User = require('./src/models/User');

async function run() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        const adminEmail = 'senthil.kumar@sunrisesolar.tn';
        const admin = await User.findOne({ email: adminEmail });
        
        if (admin) {
            const existing = await Employee.findOne({ email: adminEmail });
            if (!existing) {
                await Employee.create({
                    employeeId: 'SRS1001',
                    firstName: 'Senthil',
                    lastName: 'Kumar',
                    email: admin.email,
                    role: 'Admin',
                    department: 'Admin',
                    designation: 'Admin Manager',
                    status: 'Active',
                    dateOfJoining: new Date()
                });
                console.log('✅ Created Employee profile for Admin');
            } else {
                console.log('✅ Employee profile already exists');
            }
        } else {
            console.log('❌ Admin user not found with email:', adminEmail);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
