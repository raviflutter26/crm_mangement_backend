/**
 * Seed Script — SunRise Solar Tamil Nadu Pvt. Ltd.
 * Creates 25 users (1 Admin, 1 HR, 3 Managers, 20 Employees)
 * + February 2026 attendance + payroll + leave balances
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

// ========== 25 EMPLOYEES — SunRise Solar Tamil Nadu Pvt. Ltd. ==========
const employees = [
    // 1 Admin / MD
    { firstName: 'Senthil', lastName: 'Kumar', email: 'senthil.kumar@sunrisesolar.tn', phone: '9876543210', role: 'Admin', department: 'Management', designation: 'Managing Director', doj: '2018-04-01', ctc: 2400000, salary: { basic: 100000, hra: 40000, da: 10000, ta: 5000, special: 45000 } },

    // 1 HR
    { firstName: 'Meenakshi', lastName: 'Sundaram', email: 'meenakshi.s@sunrisesolar.tn', phone: '9876543211', role: 'HR', department: 'Human Resources', designation: 'HR Manager', doj: '2019-06-15', ctc: 960000, salary: { basic: 40000, hra: 16000, da: 4000, ta: 3000, special: 17000 } },

    // 3 Managers
    { firstName: 'Arun', lastName: 'Pandian', email: 'arun.p@sunrisesolar.tn', phone: '9876543213', role: 'Manager', department: 'Sales', designation: 'Sales Manager', doj: '2019-03-01', ctc: 1200000, salary: { basic: 50000, hra: 20000, da: 5000, ta: 3000, special: 22000 } },
    { firstName: 'Bala', lastName: 'Murugan', email: 'bala.m@sunrisesolar.tn', phone: '9876543214', role: 'Manager', department: 'Installation', designation: 'Installation Head', doj: '2019-08-01', ctc: 1080000, salary: { basic: 45000, hra: 18000, da: 4500, ta: 3000, special: 19500 } },
    { firstName: 'Lakshmi', lastName: 'Narayanan', email: 'lakshmi.n@sunrisesolar.tn', phone: '9876543215', role: 'Manager', department: 'Finance', designation: 'Finance Manager', doj: '2020-02-01', ctc: 1020000, salary: { basic: 42500, hra: 17000, da: 4250, ta: 3000, special: 18250 } },

    // 20 Employees
    { firstName: 'Karthik', lastName: 'Raja', email: 'karthik.r@sunrisesolar.tn', phone: '9876543216', role: 'Employee', department: 'Sales', designation: 'Senior Sales Executive', doj: '2020-07-01', ctc: 720000, salary: { basic: 30000, hra: 12000, da: 3000, ta: 2500, special: 12500 } },
    { firstName: 'Aarthi', lastName: 'Ganesh', email: 'aarthi.g@sunrisesolar.tn', phone: '9876543217', role: 'Employee', department: 'Sales', designation: 'Sales Executive', doj: '2021-03-15', ctc: 540000, salary: { basic: 22500, hra: 9000, da: 2250, ta: 2000, special: 9250 } },
    { firstName: 'Vijayakumar', lastName: 'R', email: 'vijay.r@sunrisesolar.tn', phone: '9876543218', role: 'Employee', department: 'Sales', designation: 'Sales Executive', doj: '2022-01-10', ctc: 480000, salary: { basic: 20000, hra: 8000, da: 2000, ta: 2000, special: 8000 } },
    { firstName: 'Gayathri', lastName: 'Devi', email: 'gayathri.d@sunrisesolar.tn', phone: '9876543219', role: 'Employee', department: 'Sales', designation: 'Business Development Associate', doj: '2023-06-01', ctc: 420000, salary: { basic: 17500, hra: 7000, da: 1750, ta: 1500, special: 7250 } },

    { firstName: 'Manikandan', lastName: 'P', email: 'mani.p@sunrisesolar.tn', phone: '9876543220', role: 'Employee', department: 'Installation', designation: 'Senior Technician', doj: '2019-11-01', ctc: 600000, salary: { basic: 25000, hra: 10000, da: 2500, ta: 2500, special: 10000 } },
    { firstName: 'Saravanan', lastName: 'M', email: 'saravanan.m@sunrisesolar.tn', phone: '9876543221', role: 'Employee', department: 'Installation', designation: 'Technician', doj: '2020-09-01', ctc: 480000, salary: { basic: 20000, hra: 8000, da: 2000, ta: 2000, special: 8000 } },
    { firstName: 'Rajeshwari', lastName: 'S', email: 'rajeshwari.s@sunrisesolar.tn', phone: '9876543222', role: 'Employee', department: 'Installation', designation: 'Technician', doj: '2021-05-15', ctc: 420000, salary: { basic: 17500, hra: 7000, da: 1750, ta: 2000, special: 6750 } },
    { firstName: 'Vignesh', lastName: 'Waran', email: 'vignesh.w@sunrisesolar.tn', phone: '9876543223', role: 'Employee', department: 'Installation', designation: 'Junior Technician', doj: '2023-02-01', ctc: 360000, salary: { basic: 15000, hra: 6000, da: 1500, ta: 1500, special: 6000 } },
    { firstName: 'Dhanush', lastName: 'K', email: 'dhanush.k@sunrisesolar.tn', phone: '9876543224', role: 'Employee', department: 'Installation', designation: 'Helper', doj: '2024-01-15', ctc: 300000, salary: { basic: 12500, hra: 5000, da: 1250, ta: 1250, special: 5000 } },

    { firstName: 'Pavithra', lastName: 'R', email: 'pavithra.r@sunrisesolar.tn', phone: '9876543225', role: 'Employee', department: 'Engineering', designation: 'Solar Engineer', doj: '2020-04-01', ctc: 840000, salary: { basic: 35000, hra: 14000, da: 3500, ta: 3000, special: 14500 } },
    { firstName: 'Sridhar', lastName: 'V', email: 'sridhar.v@sunrisesolar.tn', phone: '9876543226', role: 'Employee', department: 'Engineering', designation: 'Design Engineer', doj: '2021-08-01', ctc: 660000, salary: { basic: 27500, hra: 11000, da: 2750, ta: 2500, special: 11250 } },
    { firstName: 'Sindhu', lastName: 'B', email: 'sindhu.b@sunrisesolar.tn', phone: '9876543227', role: 'Employee', department: 'Engineering', designation: 'Quality Engineer', doj: '2022-04-15', ctc: 600000, salary: { basic: 25000, hra: 10000, da: 2500, ta: 2500, special: 10000 } },

    { firstName: 'Narayanan', lastName: 'A', email: 'narayanan.a@sunrisesolar.tn', phone: '9876543228', role: 'Employee', department: 'Finance', designation: 'Senior Accountant', doj: '2020-01-15', ctc: 660000, salary: { basic: 27500, hra: 11000, da: 2750, ta: 2500, special: 11250 } },
    { firstName: 'Deepika', lastName: 'P', email: 'deepika.p@sunrisesolar.tn', phone: '9876543229', role: 'Employee', department: 'Finance', designation: 'Accounts Executive', doj: '2022-07-01', ctc: 420000, salary: { basic: 17500, hra: 7000, da: 1750, ta: 1500, special: 7250 } },

    { firstName: 'Prakash', lastName: 'Raj', email: 'prakash.r@sunrisesolar.tn', phone: '9876543230', role: 'Employee', department: 'Warehouse', designation: 'Store Manager', doj: '2020-11-01', ctc: 540000, salary: { basic: 22500, hra: 9000, da: 2250, ta: 2000, special: 9250 } },
    { firstName: 'Tamil', lastName: 'Selvan', email: 'tamil.s@sunrisesolar.tn', phone: '9876543231', role: 'Employee', department: 'Warehouse', designation: 'Store Keeper', doj: '2022-03-01', ctc: 360000, salary: { basic: 15000, hra: 6000, da: 1500, ta: 1500, special: 6000 } },

    { firstName: 'Ishwarya', lastName: 'R', email: 'ishwarya.r@sunrisesolar.tn', phone: '9876543232', role: 'Employee', department: 'Customer Support', designation: 'Support Lead', doj: '2021-02-01', ctc: 600000, salary: { basic: 25000, hra: 10000, da: 2500, ta: 2000, special: 10500 } },
    { firstName: 'Logesh', lastName: 'Waran', email: 'logesh.w@sunrisesolar.tn', phone: '9876543233', role: 'Employee', department: 'Customer Support', designation: 'Support Executive', doj: '2023-09-01', ctc: 360000, salary: { basic: 15000, hra: 6000, da: 1500, ta: 1500, special: 6000 } },
    { firstName: 'Anitha', lastName: 'Kumar', email: 'anitha.k@sunrisesolar.tn', phone: '9876543234', role: 'Employee', department: 'Sales', designation: 'Sales Executive', doj: '2023-10-15', ctc: 450000, salary: { basic: 18500, hra: 7400, da: 1850, ta: 2000, special: 7750 } },
    { firstName: 'Kavitha', lastName: 'Selvam', email: 'kavitha.s@sunrisesolar.tn', phone: '9876543235', role: 'Employee', department: 'Human Resources', designation: 'HR Executive', doj: '2021-01-10', ctc: 540000, salary: { basic: 22500, hra: 9000, da: 2250, ta: 2000, special: 9250 } },
];

// ========== FEBRUARY 2026 CONFIG ==========
const FEB_YEAR = 2026;
const FEB_MONTH = 2;
const FEB_DAYS = 28;
const FEB_SUNDAYS = [1, 8, 15, 22]; // Sundays in Feb 2026
const FEB_WORKING_DAYS = FEB_DAYS - FEB_SUNDAYS.length; // 24 working days
// Republic Day holiday (26 Jan already passed), Let's add no holidays in Feb for simplicity

// Randomize attendance patterns
function generateFebAttendance(empId, empIdx) {
    const records = [];
    // Some employees take leaves
    const leaveDays = [];
    const lateDays = [];
    const wfhDays = [];

    // Vary by employee index to create realistic patterns
    if (empIdx % 5 === 0) { leaveDays.push(3, 4); } // 2 days leave
    if (empIdx % 7 === 0) { leaveDays.push(10); } // 1 day leave
    if (empIdx % 4 === 0) { wfhDays.push(6, 13, 20, 27); } // WFH Fridays
    if (empIdx % 3 === 0) { lateDays.push(5, 12, 19); } // Late on some days
    if (empIdx === 14) { leaveDays.push(16, 17, 18); } // 3 days sick
    if (empIdx === 20) { leaveDays.push(23, 24, 25, 26); } // 4 days personal

    for (let day = 1; day <= FEB_DAYS; day++) {
        const dateObj = new Date(FEB_YEAR, FEB_MONTH - 1, day);
        const dayOfWeek = dateObj.getDay();

        if (dayOfWeek === 0) {
            // Sunday — skip
            continue;
        }

        const isLeave = leaveDays.includes(day);
        const isWFH = wfhDays.includes(day) && !isLeave;
        const isLate = lateDays.includes(day) && !isLeave && !isWFH;

        let status = 'Present';
        let checkIn = null;
        let checkOut = null;
        let totalHours = 0;
        let lateBy = 0;
        let isLateFlag = false;
        let source = 'biometric';
        let overtime = 0;

        if (isLeave) {
            status = 'On Leave';
        } else if (isWFH) {
            status = 'WFH';
            const h = 9 + Math.floor(Math.random() * 30) / 60;
            checkIn = new Date(FEB_YEAR, FEB_MONTH - 1, day, Math.floor(h), Math.round((h % 1) * 60));
            checkOut = new Date(FEB_YEAR, FEB_MONTH - 1, day, 17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30));
            totalHours = parseFloat(((checkOut - checkIn) / 3600000).toFixed(2));
            source = 'web';
        } else {
            // Normal present
            let checkInHour = 8 + Math.floor(Math.random() * 60) / 60; // 8:00 - 9:00
            if (isLate) {
                checkInHour = 9 + (15 + Math.floor(Math.random() * 45)) / 60; // 9:15 - 10:00
                lateBy = Math.round((checkInHour - 9) * 60);
                isLateFlag = true;
            }
            checkIn = new Date(FEB_YEAR, FEB_MONTH - 1, day, Math.floor(checkInHour), Math.round((checkInHour % 1) * 60));
            const checkOutHour = 17 + Math.floor(Math.random() * 90) / 60; // 5:00 PM - 6:30 PM
            checkOut = new Date(FEB_YEAR, FEB_MONTH - 1, day, Math.floor(checkOutHour), Math.round((checkOutHour % 1) * 60));
            totalHours = parseFloat(((checkOut - checkIn) / 3600000).toFixed(2));
            overtime = Math.max(0, parseFloat((totalHours - 8).toFixed(2)));
            source = Math.random() > 0.3 ? 'biometric' : 'web';
        }

        records.push({
            employee: empId,
            date: dateObj,
            checkIn,
            checkOut,
            status,
            totalHours,
            overtime,
            source,
            lateBy,
            isLate: isLateFlag,
            effectiveHours: totalHours,
            location: checkIn ? {
                checkInLat: 19.076 + (Math.random() * 0.01),
                checkInLng: 72.877 + (Math.random() * 0.01),
                checkOutLat: checkOut ? 19.076 + (Math.random() * 0.01) : null,
                checkOutLng: checkOut ? 72.877 + (Math.random() * 0.01) : null,
            } : {},
        });
    }
    return records;
}

// ========== MAIN SEED FUNCTION ==========
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

        // Create compliance settings
        console.log('⚙️  Creating compliance settings...');
        await ComplianceSettings.create({
            pf: { enabled: true, employeeContribution: 12, employerContribution: 12, wageLimit: 15000, adminCharges: 0.5, edliCharges: 0.5 },
            esi: { enabled: true, employeeContribution: 0.75, employerContribution: 3.25, wageLimit: 21000 },
            professionalTax: {
                enabled: true, state: 'Maharashtra',
                slabs: [
                    { minSalary: 0, maxSalary: 7500, taxAmount: 0 },
                    { minSalary: 7501, maxSalary: 10000, taxAmount: 175 },
                    { minSalary: 10001, maxSalary: 999999999, taxAmount: 200 },
                ],
            },
            tds: {
                enabled: true, regime: 'new', cessRate: 4,
                newRegimeSlabs: [
                    { minIncome: 0, maxIncome: 400000, rate: 0 },
                    { minIncome: 400001, maxIncome: 800000, rate: 5 },
                    { minIncome: 800001, maxIncome: 1200000, rate: 10 },
                    { minIncome: 1200001, maxIncome: 1600000, rate: 15 },
                    { minIncome: 1600001, maxIncome: 2000000, rate: 20 },
                    { minIncome: 2000001, maxIncome: 2400000, rate: 25 },
                    { minIncome: 2400001, maxIncome: 999999999, rate: 30 },
                ],
                oldRegimeSlabs: [
                    { minIncome: 0, maxIncome: 250000, rate: 0 },
                    { minIncome: 250001, maxIncome: 500000, rate: 5 },
                    { minIncome: 500001, maxIncome: 1000000, rate: 20 },
                    { minIncome: 1000001, maxIncome: 999999999, rate: 30 },
                ],
            },
            financialYear: '2025-2026',
            companyName: 'SunRise Solar Tamil Nadu Pvt. Ltd.',
            pfRegistrationNumber: 'TN/MAS/12345',
            esiRegistrationNumber: 'TN/42/1234567',
            tanNumber: 'CHNS12345E',
            isActive: true,
        });

        // Create departments
        console.log('🏢 Creating departments...');
        const depts = ['Management', 'Human Resources', 'Sales', 'Installation', 'Engineering', 'Finance', 'Warehouse', 'Customer Support'];
        for (const d of depts) {
            await Department.create({ name: d, status: 'Active' });
        }

        // Create Designations
        console.log('🏅 Creating roles/designations...');
        const designationsList = [
            { name: 'Managing Director', level: 10, department: 'Management' },
            { name: 'HR Manager', level: 7, department: 'Human Resources' },
            { name: 'HR Executive', level: 3, department: 'Human Resources' },
            { name: 'Sales Manager', level: 7, department: 'Sales' },
            { name: 'Installation Head', level: 7, department: 'Installation' },
            { name: 'Finance Manager', level: 7, department: 'Finance' },
            { name: 'Senior Sales Executive', level: 5, department: 'Sales' },
            { name: 'Sales Executive', level: 3, department: 'Sales' },
            { name: 'Senior Technician', level: 5, department: 'Installation' },
            { name: 'Technician', level: 3, department: 'Installation' },
            { name: 'Solar Engineer', level: 5, department: 'Engineering' },
            { name: 'Design Engineer', level: 5, department: 'Engineering' },
            { name: 'Quality Engineer', level: 4, department: 'Engineering' },
            { name: 'Support Lead', level: 6, department: 'Customer Support' },
            { name: 'Support Executive', level: 3, department: 'Customer Support' },
        ];
        await Designation.insertMany(designationsList);

        // Create Branches
        console.log('📍 Creating branches...');
        const branchesList = [
            { name: 'Chennai HQ', code: 'CHN-HQ', city: 'Chennai', state: 'Tamil Nadu', country: 'India', email: 'chennai@sunrisesolar.tn' },
            { name: 'Coimbatore Ops', code: 'CBE-01', city: 'Coimbatore', state: 'Tamil Nadu', country: 'India', email: 'cbe@sunrisesolar.tn' },
        ];
        const branches = await Branch.insertMany(branchesList);

        // Create Locations
        console.log('🏢 Creating locations...');
        await Location.create({ name: 'Guindy Tech Park', branch: 'Chennai HQ', floor: '5th', capacity: 150 });
        await Location.create({ name: 'Peelamedu Office', branch: 'Coimbatore Ops', floor: '2nd', capacity: 80 });

        // Create Shifts
        console.log('🕙 Creating shifts...');
        await Shift.create({ name: 'General Shift', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 15 });
        await Shift.create({ name: 'Morning Shift', startTime: '06:00', endTime: '15:00', breakMinutes: 45, graceMinutes: 10 });

        // Create Holidays
        console.log('🗓️ Creating holidays...');
        const holidaysList = [
            { name: 'New Year Day', date: new Date('2026-01-01'), type: 'national', year: 2026 },
            { name: 'Republic Day', date: new Date('2026-01-26'), type: 'national', year: 2026 },
            { name: 'Independence Day', date: new Date('2026-08-15'), type: 'national', year: 2026 },
            { name: 'Diwali', date: new Date('2026-11-09'), type: 'national', year: 2026 },
        ];
        await Holiday.insertMany(holidaysList);

        // Create users + employees
        console.log('👥 Creating 25 users & employees...\n');
        const createdUsers = [];
        const createdEmployees = [];
        const defaultPassword = 'Solar@123';

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const empId = `SRS${String(1001 + i).padStart(4, '0')}`;

            // Create User
            const user = await User.create({
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email,
                password: defaultPassword,
                role: emp.role,
                department: emp.department,
                designation: emp.designation,
                isActive: true,
                isFirstLogin: false
            });
            createdUsers.push(user);

            // Create Employee
            const employee = await Employee.create({
                employeeId: empId,
                firstName: emp.firstName,
                lastName: emp.lastName,
                email: emp.email,
                phone: emp.phone,
                department: emp.department,
                designation: emp.designation,
                dateOfJoining: new Date(emp.doj),
                ctc: emp.ctc,
                salary: {
                    basic: emp.salary.basic,
                    hra: emp.salary.hra,
                    da: emp.salary.da,
                    ta: emp.salary.ta,
                    specialAllowance: emp.salary.special,
                },
                role: emp.role || 'Employee',
                status: 'Active',
                employmentType: 'Full-time',
                pan: `ABCDE${String(1000 + i).padStart(4, '0')}F`,
                aadhaar: `${String(Math.floor(Math.random() * 9000 + 1000))} ${String(Math.floor(Math.random() * 9000 + 1000))} ${String(Math.floor(Math.random() * 9000 + 1000))}`,
                uan: `1001${String(1000000 + i)}`,
                pfEnabled: emp.salary.basic <= 15000,
                esiEnabled: (emp.salary.basic + emp.salary.hra + emp.salary.da + emp.salary.ta + emp.salary.special) <= 21000,
                taxRegime: 'new',
            });
            createdEmployees.push(employee);

            console.log(`  ✅ ${empId} | ${emp.firstName} ${emp.lastName} | ${emp.role.toUpperCase()} | ${emp.department} | ₹${(emp.salary.basic + emp.salary.hra + emp.salary.da + emp.salary.ta + emp.salary.special).toLocaleString()}/mo`);
        }

        // Assign Managers
        console.log('\n🔗 Assigning reporting managers...');
        const adminId = createdEmployees[0]._id; // Ravi Kumar
        const hrId = createdEmployees[1]._id; // Ananya Sharma
        const salesManagerId = createdEmployees[3]._id; // Deepak Singh
        const installManagerId = createdEmployees[4]._id; // Priya Patel
        const financeManagerId = createdEmployees[5]._id; // Aditya Joshi

        // Managers report to Admin
        await Employee.findByIdAndUpdate(createdEmployees[1]._id, { reportingManager: adminId }); // HR
        await Employee.findByIdAndUpdate(createdEmployees[2]._id, { reportingManager: hrId }); // HR Exec to HR Mgr
        await Employee.findByIdAndUpdate(createdEmployees[3]._id, { reportingManager: adminId }); // Sales Mgr
        await Employee.findByIdAndUpdate(createdEmployees[4]._id, { reportingManager: adminId }); // Install Mgr
        await Employee.findByIdAndUpdate(createdEmployees[5]._id, { reportingManager: adminId }); // Finance Mgr

        // Employees report to respective Managers
        for (let i = 6; i < createdEmployees.length; i++) {
            const emp = createdEmployees[i];
            let managerId = adminId;
            if (emp.department === 'Sales') managerId = salesManagerId;
            else if (emp.department === 'Installation') managerId = installManagerId;
            else if (emp.department === 'Finance') managerId = financeManagerId;
            else if (emp.department === 'Engineering') managerId = adminId;
            else if (emp.department === 'Warehouse') managerId = installManagerId;
            else if (emp.department === 'Customer Support') managerId = hrId;

            await Employee.findByIdAndUpdate(emp._id, { reportingManager: managerId });
        }
        console.log('  ✅ Managers assigned!\n');

        // ========== FEBRUARY 2026 ATTENDANCE ==========
        console.log('\n📅 Generating February 2026 attendance...');
        let totalAttendanceRecords = 0;
        for (let i = 0; i < createdEmployees.length; i++) {
            const records = generateFebAttendance(createdEmployees[i]._id, i);
            await Attendance.insertMany(records);
            totalAttendanceRecords += records.length;
        }
        console.log(`  ✅ ${totalAttendanceRecords} attendance records created\n`);

        // ========== FEBRUARY 2026 PAYROLL ==========
        console.log('💰 Processing February 2026 payroll...');
        const payrollRecordIds = [];
        let totalGross = 0, totalDed = 0, totalNet = 0;
        let totalPF = 0, totalESI = 0, totalPT = 0, totalTDS = 0;
        let totalErPF = 0, totalErESI = 0;

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            const empDoc = createdEmployees[i];
            const s = emp.salary;
            const gross = s.basic + s.hra + s.da + s.ta + s.special;

            // Count present days
            const presentCount = await Attendance.countDocuments({
                employee: empDoc._id,
                date: { $gte: new Date(2026, 1, 1), $lte: new Date(2026, 1, 28) },
                status: { $in: ['Present', 'WFH'] },
            });
            const halfDayCount = await Attendance.countDocuments({
                employee: empDoc._id,
                date: { $gte: new Date(2026, 1, 1), $lte: new Date(2026, 1, 28) },
                status: 'Half Day',
            });
            const presentDays = presentCount + (halfDayCount * 0.5);
            const payableDays = presentDays;
            const payableRatio = payableDays / FEB_WORKING_DAYS;

            // Pro-rata salary
            const proRataBasic = Math.round(s.basic * payableRatio);
            const proRataHRA = Math.round(s.hra * payableRatio);
            const proRataDA = Math.round(s.da * payableRatio);
            const proRataTA = Math.round(s.ta * payableRatio);
            const proRataSpecial = Math.round(s.special * payableRatio);
            const proRataGross = proRataBasic + proRataHRA + proRataDA + proRataTA + proRataSpecial;

            // PF: 12% of basic (capped at ₹15000)
            const pfWage = Math.min(proRataBasic, 15000);
            const empPF = Math.round(pfWage * 0.12);
            const erPF = Math.round(pfWage * 0.12);

            // ESI: only if gross ≤ 21000
            let empESI = 0, erESI = 0;
            if (gross <= 21000) {
                empESI = Math.round(proRataGross * 0.0075);
                erESI = Math.round(proRataGross * 0.0325);
            }

            // Professional Tax
            let pt = 0;
            if (gross > 10000) pt = 200;
            else if (gross > 7500) pt = 175;

            // TDS (simplified — annual projection / 12)
            const annualGross = gross * 12;
            const annualPF = empPF * 12;
            const taxableIncome = annualGross - annualPF - 50000; // Std deduction
            let annualTax = 0;
            if (taxableIncome > 2400000) annualTax += (taxableIncome - 2400000) * 0.30;
            if (taxableIncome > 2000000) annualTax += Math.min(taxableIncome - 2000000, 400000) * 0.25;
            if (taxableIncome > 1600000) annualTax += Math.min(taxableIncome - 1600000, 400000) * 0.20;
            if (taxableIncome > 1200000) annualTax += Math.min(taxableIncome - 1200000, 400000) * 0.15;
            if (taxableIncome > 800000) annualTax += Math.min(taxableIncome - 800000, 400000) * 0.10;
            if (taxableIncome > 400000) annualTax += Math.min(taxableIncome - 400000, 400000) * 0.05;
            annualTax = annualTax + (annualTax * 0.04); // 4% cess
            // Rebate u/s 87A for income ≤ ₹12L under new regime (full rebate)
            if (taxableIncome <= 1200000) annualTax = 0;
            const monthlyTDS = Math.round(annualTax / 12);

            const totalDeductions = empPF + empESI + pt + monthlyTDS;
            const netPay = proRataGross - totalDeductions;

            const payrollRecord = await Payroll.create({
                employee: empDoc._id,
                month: 2,
                year: 2026,
                earnings: { basic: proRataBasic, hra: proRataHRA, da: proRataDA, ta: proRataTA, specialAllowance: proRataSpecial },
                deductions: { pf: empPF, esi: empESI, tax: monthlyTDS, professionalTax: pt },
                totalEarnings: proRataGross,
                totalDeductions,
                netPay,
                workingDays: FEB_WORKING_DAYS,
                presentDays,
                leaveDays: FEB_WORKING_DAYS - presentDays,
                paymentStatus: 'Paid',
                paymentDate: new Date(2026, 2, 1),
                paymentMethod: 'Bank Transfer',
            });

            payrollRecordIds.push(payrollRecord._id);
            totalGross += proRataGross;
            totalDed += totalDeductions;
            totalNet += netPay;
            totalPF += empPF;
            totalESI += empESI;
            totalPT += pt;
            totalTDS += monthlyTDS;
            totalErPF += erPF;
            totalErESI += erESI;

            console.log(`  💵 ${emp.firstName.padEnd(12)} | Gross: ₹${proRataGross.toLocaleString().padStart(8)} | PF: ₹${empPF.toLocaleString().padStart(5)} | ESI: ₹${empESI.toLocaleString().padStart(4)} | PT: ₹${pt} | TDS: ₹${monthlyTDS.toLocaleString().padStart(6)} | Net: ₹${netPay.toLocaleString().padStart(8)}`);
        }

        // Create PayrollRun
        await PayrollRun.create({
            month: 2,
            year: 2026,
            status: 'paid',
            totalEmployees: 25,
            payrollRecords: payrollRecordIds,
            totalGrossPay: totalGross,
            totalDeductions: totalDed,
            totalNetPay: totalNet,
            totalPF,
            totalESI,
            totalPT,
            totalTDS,
            totalEmployerPF: totalErPF,
            totalEmployerESI: totalErESI,
            initiatedBy: createdUsers[0]._id,
            approvedBy: createdUsers[0]._id,
            approvedAt: new Date(2026, 1, 28),
            paidAt: new Date(2026, 2, 1),
            paymentMode: 'bank_transfer',
        });

        console.log(`\n  📊 Payroll Summary:`);
        console.log(`     Total Gross: ₹${totalGross.toLocaleString()}`);
        console.log(`     Total Deductions: ₹${totalDed.toLocaleString()}`);
        console.log(`     Total Net Pay: ₹${totalNet.toLocaleString()}`);
        console.log(`     PF: ₹${totalPF.toLocaleString()} | ESI: ₹${totalESI.toLocaleString()} | PT: ₹${totalPT.toLocaleString()} | TDS: ₹${totalTDS.toLocaleString()}`);

        // ========== LEAVE BALANCES ==========
        console.log('\n📋 Creating leave balances (12 Sick + 12 Casual + Comp-Off)...');

        // Create some leave records for used leaves
        const leaveReasons = {
            'Sick Leave': ['Fever and cold', 'Doctor appointment', 'Food poisoning', 'Dental treatment'],
            'Casual Leave': ['Personal work', 'Family function', 'Festival celebration', 'Bank work'],
            'Compensatory Off': ['Worked on Sunday 18 Jan', 'Worked on Republic Day'],
        };

        for (let i = 0; i < createdEmployees.length; i++) {
            const empDoc = createdEmployees[i];

            // Some employees used sick leave in Feb
            if (i === 14) {
                // Ajay Chauhan — 3 days sick leave
                await Leave.create({
                    employee: empDoc._id,
                    leaveType: 'Sick Leave',
                    startDate: new Date(2026, 1, 16),
                    endDate: new Date(2026, 1, 18),
                    totalDays: 3,
                    reason: 'Viral fever with body ache',
                    status: 'Approved',
                    approvedBy: createdUsers[1]._id,
                    approvedAt: new Date(2026, 1, 16),
                });
            }
            if (i === 20) {
                // Rohit Saxena — 4 days personal
                await Leave.create({
                    employee: empDoc._id,
                    leaveType: 'Casual Leave',
                    startDate: new Date(2026, 1, 23),
                    endDate: new Date(2026, 1, 26),
                    totalDays: 4,
                    reason: 'Sister wedding preparations and ceremony',
                    status: 'Approved',
                    approvedBy: createdUsers[1]._id,
                    approvedAt: new Date(2026, 1, 20),
                });
            }
            if (i % 5 === 0) {
                // Some employees took 2 days leave
                await Leave.create({
                    employee: empDoc._id,
                    leaveType: i % 2 === 0 ? 'Casual Leave' : 'Sick Leave',
                    startDate: new Date(2026, 1, 3),
                    endDate: new Date(2026, 1, 4),
                    totalDays: 2,
                    reason: i % 2 === 0 ? 'Family function at hometown' : 'Severe headache and migraine',
                    status: 'Approved',
                    approvedBy: createdUsers[1]._id,
                    approvedAt: new Date(2026, 1, 2),
                });
            }

            // Add a comp-off for some employees
            if (i % 8 === 0) {
                await Leave.create({
                    employee: empDoc._id,
                    leaveType: 'Compensatory Off',
                    startDate: new Date(2026, 1, 27),
                    endDate: new Date(2026, 1, 27),
                    totalDays: 1,
                    reason: 'Worked on Sunday 18 Jan for urgent client installation',
                    status: 'Approved',
                    approvedBy: createdUsers[3]._id,
                    approvedAt: new Date(2026, 1, 25),
                });
            }
        }

        console.log('  ✅ Leave records created\n');

        // ========== SUMMARY ==========
        console.log('═══════════════════════════════════════════════');
        console.log('  🌞 SunRise Solar Tamil Nadu — Seed Complete');
        console.log('═══════════════════════════════════════════════');
        console.log(`  👤 Users:           25`);
        console.log(`  👥 Employees:       25`);
        console.log(`  📅 Attendance:      ${totalAttendanceRecords} records (Feb 2026)`);
        console.log(`  💰 Payroll Records: 25 (Feb 2026 — Paid)`);
        console.log(`  📋 Leave Records:   Created with balances`);
        console.log(`  ⚙️  Compliance:     PF/ESI/PT/TDS configured`);
        console.log(`  🏢 Departments:     8`);
        console.log('');
        console.log('  🔑 Login Credentials:');
        console.log('  ──────────────────────────────────────────');
        console.log('  ADMIN:    senthil.kumar@sunrisesolar.tn');
        console.log('  HR:       meenakshi.s@sunrisesolar.tn');
        console.log('  MANAGER:  arun.p@sunrisesolar.tn');
        console.log('  EMPLOYEE: karthik.r@sunrisesolar.tn');
        console.log('  Password: Solar@123 (for all users)');
        console.log('═══════════════════════════════════════════════\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed failed:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();
