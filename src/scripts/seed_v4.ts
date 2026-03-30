import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Organization from '../models/Organization';
import Department from '../models/Department';
import AuditLog from '../models/AuditLog';
import Invitation from '../models/Invitation';

// @ts-ignore
import Employee from '../models/Employee';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seed = async () => {
    try {
        console.log('🚀 Starting System Reset & Seeding (v4)...');
        
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
        await mongoose.connect(mongoUri);
        console.log('📦 Connected to MongoDB (Database: test)');

        if (!mongoose.connection.db) {
            throw new Error('Database connection failed');
        }

        // 1. Clean Slate - Clear ALL collections (including users and solar_employees)
        console.log('🧹 Clearing all existing data in the database...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const collection of collections) {
            console.log(`🗑️  Clearing collection: ${collection.name}`);
            await mongoose.connection.db.collection(collection.name).deleteMany({});
        }
        console.log('✅ All collections cleared.');

        // 2. Create Super Admin
        console.log('👑 Creating Super Admin...');
        const superAdmin = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin@platform.com',
            password: 'Admin@123',
            role: 'superadmin',
            organizationId: null,
            auth: { isEmailVerified: true, isFirstLogin: false },
            employment: { status: 'active' }
        });
        console.log(`✅ Super Admin created: ${superAdmin.email}`);

        // 3. Create Organization A
        console.log('🏢 Creating Organization A...');
        const orgA = await Organization.create({
            name: 'Organization A',
            slug: 'org-a',
            email: 'admin@orga.com',
            status: 'active',
            settings: {
                payroll: { epfEnabled: true, esiEnabled: true, ptEnabled: true, lwfEnabled: true }
            },
            createdBy: superAdmin._id
        });
        console.log(`✅ Organization A created: ${orgA.name}`);

        // 4. Create Org Admin
        console.log('👤 Creating Org Admin & Employee record...');
        const adminEmail = 'admin@orga.com';
        const adminEmpId = 'ORGA-ADM-01';
        const orgAdmin = await User.create({
            firstName: 'OrgA',
            lastName: 'Admin',
            email: adminEmail,
            password: 'Admin@123',
            role: 'admin',
            organizationId: orgA._id,
            employeeId: adminEmpId,
            auth: { isEmailVerified: true, isFirstLogin: false },
            employment: { status: 'active' }
        });
        await Employee.create({
            firstName: 'OrgA',
            lastName: 'Admin',
            email: adminEmail,
            role: 'Admin',
            organizationId: orgA._id,
            employeeId: adminEmpId,
            status: 'Active'
        });
        console.log(`✅ Org Admin created: ${orgAdmin.email}`);

        // 5. Create Org HR
        console.log('👤 Creating Org HR & Employee record...');
        const hrEmail = 'hr@orga.com';
        const hrEmpId = 'ORGA-HR-01';
        const orgHR = await User.create({
            firstName: 'OrgA',
            lastName: 'HR',
            email: hrEmail,
            password: 'Admin@123',
            role: 'hr',
            organizationId: orgA._id,
            employeeId: hrEmpId,
            auth: { isEmailVerified: true, isFirstLogin: false },
            employment: { status: 'active' }
        });
        await Employee.create({
            firstName: 'OrgA',
            lastName: 'HR',
            email: hrEmail,
            role: 'HR',
            organizationId: orgA._id,
            employeeId: hrEmpId,
            status: 'Active'
        });
        console.log(`✅ Org HR created: ${orgHR.email}`);

        // 6. Create Departments
        console.log('🏢 Creating Departments...');
        const deptEng = await Department.create({
            name: 'Engineering',
            code: 'ENG',
            organizationId: orgA._id,
            createdBy: orgAdmin._id
        });
        const deptSales = await Department.create({
            name: 'Sales',
            code: 'SALES',
            organizationId: orgA._id,
            createdBy: orgAdmin._id
        });
        console.log(`✅ Departments created: ${deptEng.name}, ${deptSales.name}`);

        // 7. Create Managers
        console.log('👤 Creating Managers & Employee records...');
        const managersData = [
            { firstName: 'Eng', lastName: 'Manager', email: 'mgr.eng@orga.com', deptId: deptEng._id, empId: 'ORGA-ENG-MGR' },
            { firstName: 'Sales', lastName: 'Manager', email: 'mgr.sales@orga.com', deptId: deptSales._id, empId: 'ORGA-SAL-MGR' },
        ];

        const managers: any[] = [];
        for (const data of managersData) {
            const user = await User.create({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: 'Admin@123',
                role: 'manager',
                organizationId: orgA._id,
                departmentId: data.deptId,
                employeeId: data.empId,
                auth: { isEmailVerified: true, isFirstLogin: false },
                employment: { status: 'active' }
            });
            await Employee.create({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                role: 'Manager',
                organizationId: orgA._id,
                department: data.deptId,
                employeeId: data.empId,
                status: 'Active'
            });
            managers.push(user);
        }
        
        // Link managers to Departments
        await Department.findByIdAndUpdate(deptEng._id, { managerId: managers[0]._id });
        await Department.findByIdAndUpdate(deptSales._id, { managerId: managers[1]._id });
        
        console.log(`✅ Managers created: ${managers[0].email}, ${managers[1].email}`);

        // 8. Create Employees
        console.log('👤 Creating Employees & Employee records...');
        const employeesData = [
            { firstName: 'Emp1', lastName: 'Eng', email: 'emp1.eng@orga.com', deptId: deptEng._id, mgrId: managers[0]._id, empId: 'ORGA-ENG-01' },
            { firstName: 'Emp2', lastName: 'Eng', email: 'emp2.eng@orga.com', deptId: deptEng._id, mgrId: managers[0]._id, empId: 'ORGA-ENG-02' },
            { firstName: 'Emp1', lastName: 'Sales', email: 'emp1.sales@orga.com', deptId: deptSales._id, mgrId: managers[1]._id, empId: 'ORGA-SAL-01' },
            { firstName: 'Emp2', lastName: 'Sales', email: 'emp2.sales@orga.com', deptId: deptSales._id, mgrId: managers[1]._id, empId: 'ORGA-SAL-02' },
        ];

        for (const data of employeesData) {
            await User.create({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: 'Admin@123',
                role: 'employee',
                organizationId: orgA._id,
                departmentId: data.deptId,
                managerId: data.mgrId,
                employeeId: data.empId,
                auth: { isEmailVerified: true, isFirstLogin: false },
                employment: { status: 'active' }
            });
            await Employee.create({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                role: 'Employee',
                organizationId: orgA._id,
                department: data.deptId,
                reportingManager: data.mgrId,
                employeeId: data.empId,
                status: 'Active'
            });
        }
        console.log(`✅ 4 Employees created with dual records.`);

        console.log('✨ Seeding Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding Failed:', err);
        process.exit(1);
    }
};

seed();
