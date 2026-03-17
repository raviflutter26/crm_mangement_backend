const mongoose = require('mongoose');
const ModulePermission = require('./models/ModulePermission');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

const initialPermissions = [
    { module: 'dashboard', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'employees', roles: ['Admin', 'HR', 'Manager'] },
    { module: 'attendance', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'leaves', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'permissions', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'payroll', roles: ['Admin', 'HR'] },
    { module: 'organization', roles: ['Admin', 'HR'] },
    { module: 'departments', roles: ['Admin', 'HR'] },
    { module: 'recruitment', roles: ['Admin', 'HR'] },
    { module: 'performance', roles: ['Admin', 'HR', 'Manager'] },
    { module: 'expenses', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'compliance', roles: ['Admin'] },
    { module: 'assets', roles: ['Admin', 'HR'] },
    { module: 'self-service', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'reports', roles: ['Admin', 'HR', 'Manager'] },
    { module: 'roles', roles: ['Admin'] },
    { module: 'settings', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
    { module: 'help', roles: ['Admin', 'HR', 'Manager', 'Employee'] },
];

async function seedPermissions() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const p of initialPermissions) {
            await ModulePermission.findOneAndUpdate(
                { module: p.module },
                { roles: p.roles },
                { upsert: true, new: true }
            );
        }

        console.log('Module Permissions seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedPermissions();
