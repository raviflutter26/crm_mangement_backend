import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Organization from '../models/Organization';
import Department from '../models/Department';
import AuditLog from '../models/AuditLog';
import Invitation from '../models/Invitation';

dotenv.config();

const seed = async () => {
    try {
        console.log('🚀 Starting System Reset & Seeding...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_saas');
        console.log('📦 Connected to MongoDB');

        // 1. Clean Slate
        console.log('🧹 Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Organization.deleteMany({}),
            Department.deleteMany({}),
            AuditLog.deleteMany({}),
            Invitation.deleteMany({})
        ]);
        console.log('✅ All collections cleared.');

        // 2. Create Super Admin
        console.log('👑 Creating Super Admin...');
        const superAdmin = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@v-hrms.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
            role: 'superadmin',
            organizationId: null,
            auth: {
                isEmailVerified: true,
                isFirstLogin: false
            },
            employment: {
                status: 'active'
            }
        });
        console.log(`✅ Super Admin created: ${superAdmin.email}`);

        // 3. Create Sample Organization (Optional but helpful for testing)
        console.log('🏢 Creating Sample Organization...');
        const org = await Organization.create({
            name: 'V-HRMS Demo Corp',
            slug: 'v-hrms-demo',
            email: 'admin@v-hrms-demo.com',
            status: 'active',
            settings: {
                payroll: { epfEnabled: true, esiEnabled: true, ptEnabled: true, lwfEnabled: true }
            },
            createdBy: superAdmin._id
        });
        console.log(`✅ Sample Organization created: ${org.name}`);

        // 4. Create Org Admin
        console.log('👤 Creating Org Admin...');
        const orgAdmin = await User.create({
            firstName: 'Demo',
            lastName: 'Admin',
            email: 'admin@v-hrms-demo.com',
            password: 'Admin@123',
            role: 'admin',
            organizationId: org._id,
            employeeId: 'EMP0001',
            auth: {
                isEmailVerified: true,
                isFirstLogin: false
            },
            employment: {
                status: 'active'
            }
        });
        console.log(`✅ Org Admin created: ${orgAdmin.email}`);

        console.log('✨ Seeding Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding Failed:', err);
        process.exit(1);
    }
};

seed();
