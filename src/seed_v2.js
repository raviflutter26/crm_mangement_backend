/**
 * Seed Script V2 — SunRise Solar Tamil Nadu Pvt. Ltd.
 * Based on new department list and 5-member-per-dept rule.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Payroll = require('./models/Payroll');
const PayrollRun = require('./models/PayrollRun');
const Leave = require('./models/Leave');
const Department = require('./models/Department');
const Designation = require('./models/Designation');
const Branch = require('./models/Branch');
const Location = require('./models/Location');
const Shift = require('./models/Shift');
const Holiday = require('./models/Holiday');
const ComplianceSettings = require('./models/ComplianceSettings');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

const departments = [
    "Admin",
    "Human Resources",
    "Finance",
    "Sales & Marketing",
    "Production",
    "Design & Quality",
    "Logistics",
    "Store"
];

const names = [
    { first: "Senthil", last: "Kumar" }, { first: "Meenakshi", last: "Sundaram" },
    { first: "Arun", last: "Pandian" }, { first: "Bala", last: "Murugan" },
    { first: "Lakshmi", last: "Narayanan" }, { first: "Karthik", last: "Raja" },
    { first: "Aarthi", last: "Ganesh" }, { first: "Vijayakumar", last: "R" },
    { first: "Gayathri", last: "Devi" }, { first: "Manikandan", last: "P" },
    { first: "Saravanan", last: "M" }, { first: "Rajeshwari", last: "S" },
    { first: "Vignesh", last: "Waran" }, { first: "Dhanush", last: "K" },
    { first: "Pavithra", last: "R" }, { first: "Sridhar", last: "V" },
    { first: "Sindhu", last: "B" }, { first: "Narayanan", last: "A" },
    { first: "Deepika", last: "P" }, { first: "Prakash", last: "Raj" },
    { first: "Tamil", last: "Selvan" }, { first: "Ishwarya", last: "R" },
    { first: "Logesh", last: "Waran" }, { first: "Anitha", last: "Kumar" },
    { first: "Kavitha", last: "Selvam" }, { first: "Ramesh", last: "Babu" },
    { first: "Suresh", last: "Raina" }, { first: "Divya", last: "Bharathi" },
    { first: "Priya", last: "Mani" }, { first: "Gautham", last: "Vasudev" },
    { first: "Madhavan", last: "R" }, { first: "Jyothika", last: "S" },
    { first: "Surya", last: "Sivakumar" }, { first: "Karthi", last: "Sivakumar" },
    { first: "Nayanthara", last: "K" }, { first: "Trisha", last: "K" },
    { first: "Vijay", last: "Sethupathi" }, { first: "Sivakarthikeyan", last: "D" },
    { first: "Anirudh", last: "Ravichander" }, { first: "Ilaiyaraaja", last: "M" }
];

async function seed() {
    try {
        console.log('🌱 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected!\n');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Employee.deleteMany({}),
            Attendance.deleteMany({}),
            Payroll.deleteMany({}),
            PayrollRun.deleteMany({}),
            Leave.deleteMany({}),
            ComplianceSettings.deleteMany({}),
            Department.deleteMany({}),
            Designation.deleteMany({}),
            Branch.deleteMany({}),
            Location.deleteMany({}),
            Shift.deleteMany({}),
            Holiday.deleteMany({}),
        ]);
        console.log('✅ Cleared!\n');

        // Setup base organization
        console.log('⚙️  Creating organization data...');
        await ComplianceSettings.create({
            companyName: 'SunRise Solar Tamil Nadu Pvt. Ltd.',
            pf: { enabled: true, employeeContribution: 12, employerContribution: 12, wageLimit: 15000 },
            esi: { enabled: true, employeeContribution: 0.75, employerContribution: 3.25, wageLimit: 21000 },
            financialYear: '2025-2026',
            isActive: true
        });

        const generalShift = await Shift.create({ name: 'General Shift', startTime: '09:00', endTime: '18:00', breakMinutes: 60 });
        const hq = await Branch.create({ name: 'Chennai HQ', code: 'CHN-HQ', city: 'Chennai', state: 'Tamil Nadu' });

        // Create Departments
        const deptDocs = [];
        for (const d of departments) {
            const doc = await Department.create({ name: d, status: 'Active' });
            deptDocs.push(doc);
        }

        console.log('👥 Creating 40 users & employees...');
        let nameIdx = 0;
        const createdEmployees = [];

        for (const dept of departments) {
            let managerDoc = null;

            for (let i = 0; i < 5; i++) {
                const isManager = (i === 0);
                const person = names[nameIdx++];
                const role = isManager ? "Manager" : "Employee";
                // Specific override for first dept (Admin) to have 1 Admin
                const finalRole = (dept === "Admin" && isManager) ? "Admin" : role;
                
                // Don't add .mgr for the main Admin
                const hasMgrSuffix = isManager && finalRole !== "Admin";
                const email = `${person.first.toLowerCase()}.${person.last.toLowerCase()}${hasMgrSuffix ? '.mgr' : ''}@sunrisesolar.tn`;
                const empId = `SRS${String(1000 + nameIdx).padStart(4, '0')}`;

                const user = await User.create({
                    name: `${person.first} ${person.last}`,
                    email,
                    password: 'Solar@123',
                    role: finalRole,
                    department: dept,
                    isActive: true
                });

                const employee = await Employee.create({
                    employeeId: empId,
                    firstName: person.first,
                    lastName: person.last,
                    email,
                    phone: `98765${String(10000 + nameIdx)}`,
                    department: dept,
                    designation: isManager ? `${dept} Manager` : `${dept} Associate`,
                    role: finalRole,
                    reportingManager: managerDoc ? managerDoc._id : null,
                    status: 'Active',
                    employmentType: 'Full-time',
                    dateOfJoining: new Date('2024-01-01'),
                    salary: { 
                        basic: isManager ? 45000 : 25000, 
                        hra: isManager ? 18000 : 10000, 
                        specialAllowance: 5000 
                    },
                    ctc: isManager ? 1200000 : 600000
                });

                if (isManager) managerDoc = employee;
                createdEmployees.push(employee);
            }
            console.log(`  ✅ Department: ${dept} (1 Manager, 4 Employees)`);
        }

        console.log('\n📅 Generating initial attendance (Current Month)...');
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        for (const emp of createdEmployees) {
            const attendanceRecords = [];
            for (let d = 1; d <= today.getDate(); d++) {
                const date = new Date(today.getFullYear(), today.getMonth(), d);
                if (date.getDay() === 0) continue; // Skip Sundays

                attendanceRecords.push({
                    employee: emp._id,
                    date,
                    status: 'Present',
                    checkIn: new Date(date.setHours(9, 0)),
                    checkOut: new Date(date.setHours(18, 0)),
                    totalHours: 9
                });
            }
            if (attendanceRecords.length > 0) await Attendance.insertMany(attendanceRecords);
        }

        console.log('\n🏁 Seed Complete!');
        console.log('   Total Departments: 8');
        console.log('   Total Employees:   40');
        console.log('   Admin Login:      senthil.kumar@sunrisesolar.tn / Solar@123');
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    }
}

seed();
