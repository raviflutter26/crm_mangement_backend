/**
 * One-off seed: creates 2 sample organizations with a full department hierarchy
 * (Org Admin, HR, 3 departments x Manager + 3 Employees each) using the merged
 * User schema. All employee names are fictional; company names are fictional too.
 *
 * Usage: node src/seedSampleOrgHierarchy.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Organization = require('./models/Organization');
const User = require('./models/User');
const Department = require('./models/Department');

const ORGS = [
    {
        key: 'CT',
        org: {
            name: 'Cauvery Technologies Pvt Ltd',
            email: 'hr@cauverytech.test',
            phone: '9840011111',
            industry: 'Information Technology',
            companySize: '51-200',
            foundedYear: 2014,
            address: { street: '12 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', country: 'India', pincode: '600002' },
        },
        domain: 'cauverytech.test',
        admin: ['Karthikeyan', 'Subramaniam'],
        hr: ['Meena', 'Rajan'],
        departments: {
            Engineering: {
                manager: ['Arun', 'Krishnan'],
                employees: [['Selvam', 'Murugan'], ['Priya', 'Nadar'], ['Vignesh', 'Iyer']],
            },
            Finance: {
                manager: ['Lakshmi', 'Chettiar'],
                employees: [['Suresh', 'Gounder'], ['Kavya', 'Raman'], ['Dinesh', 'Natarajan']],
            },
            Operations: {
                manager: ['Senthil', 'Velu'],
                employees: [['Divya', 'Sundaram'], ['Ganesh', 'Balasubramaniam'], ['Anitha', 'Ramasamy']],
            },
        },
    },
    {
        key: 'NI',
        org: {
            name: 'Nilgiris Industries Pvt Ltd',
            email: 'hr@nilgirisindustries.test',
            phone: '9840022222',
            industry: 'Manufacturing',
            companySize: '51-200',
            foundedYear: 2009,
            address: { street: '45 Race Course Road', city: 'Coimbatore', state: 'Tamil Nadu', country: 'India', pincode: '641018' },
        },
        domain: 'nilgirisindustries.test',
        admin: ['Rajesh', 'Muthusamy'],
        hr: ['Sangeetha', 'Manickam'],
        departments: {
            Engineering: {
                manager: ['Bala', 'Palaniappan'],
                employees: [['Nithya', 'Sivakumar'], ['Prakash', 'Iyengar'], ['Deepa', 'Pillai']],
            },
            Finance: {
                manager: ['Kumaresan', 'Rajan'],
                employees: [['Revathi', 'Krishnan'], ['Elango', 'Nadar'], ['Kalaivani', 'Chettiar']],
            },
            Operations: {
                manager: ['Manikandan', 'Gounder'],
                employees: [['Shanthi', 'Raman'], ['Sathish', 'Natarajan'], ['Uma', 'Velu']],
            },
        },
    },
];

function makeEmail(firstName, lastName, domain) {
    return `${firstName}.${lastName}@${domain}`.toLowerCase();
}

async function createPerson({ firstName, lastName, role, designation, department, organizationId, domain, employeeId, reportingManager, joinYear }) {
    const email = makeEmail(firstName, lastName, domain);
    const existing = await User.findOne({ email });
    if (existing) {
        console.log(`SKIP (exists) ${email}`);
        return existing;
    }
    const user = await User.create({
        firstName,
        lastName,
        email,
        phone: `98${String(Math.floor(10000000 + Math.random() * 89999999))}`,
        role,
        organizationId,
        department: department || null,
        designation,
        employeeId,
        reportingManager: reportingManager || null,
        dateOfJoining: new Date(`${joinYear}-06-01`),
        employmentType: 'Full-time',
        status: 'Active',
        isActive: true,
        password: null,
        isFirstLogin: true,
        isPasswordSet: false,
    });
    console.log(`CREATE ${role.padEnd(9)} ${department ? department.padEnd(11) : ''.padEnd(11)} ${email}`);
    return user;
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    for (const spec of ORGS) {
        let orgDoc = await Organization.findOne({ email: spec.org.email });
        if (orgDoc) {
            console.log(`SKIP (exists) organization ${spec.org.name}`);
        } else {
            orgDoc = await Organization.create(spec.org);
            console.log(`CREATE organization ${orgDoc.name} (${orgDoc._id})`);
        }

        let seq = 1;
        const nextEmployeeId = () => `${spec.key}-${String(seq++).padStart(4, '0')}`;

        const admin = await createPerson({
            firstName: spec.admin[0], lastName: spec.admin[1], role: 'admin',
            designation: 'Organization Admin', department: null,
            organizationId: orgDoc._id, domain: spec.domain, employeeId: nextEmployeeId(), joinYear: 2020,
        });

        const hr = await createPerson({
            firstName: spec.hr[0], lastName: spec.hr[1], role: 'hr',
            designation: 'HR Manager', department: 'Human Resources',
            organizationId: orgDoc._id, domain: spec.domain, employeeId: nextEmployeeId(),
            reportingManager: admin._id, joinYear: 2020,
        });

        await Department.findOneAndUpdate(
            { organizationId: orgDoc._id, name: 'Human Resources' },
            { organizationId: orgDoc._id, name: 'Human Resources', code: 'HR', managerId: hr._id, status: 'active', createdBy: admin._id },
            { upsert: true }
        );

        for (const [deptName, dept] of Object.entries(spec.departments)) {
            const manager = await createPerson({
                firstName: dept.manager[0], lastName: dept.manager[1], role: 'manager',
                designation: `${deptName} Manager`, department: deptName,
                organizationId: orgDoc._id, domain: spec.domain, employeeId: nextEmployeeId(),
                reportingManager: admin._id, joinYear: 2021,
            });

            await Department.findOneAndUpdate(
                { organizationId: orgDoc._id, name: deptName },
                { organizationId: orgDoc._id, name: deptName, code: deptName.split(' ').map(w => w[0]).join('').toUpperCase(), managerId: manager._id, status: 'active', createdBy: admin._id },
                { upsert: true }
            );

            for (const [firstName, lastName] of dept.employees) {
                await createPerson({
                    firstName, lastName, role: 'employee',
                    designation: `${deptName} Executive`, department: deptName,
                    organizationId: orgDoc._id, domain: spec.domain, employeeId: nextEmployeeId(),
                    reportingManager: manager._id, joinYear: 2022,
                });
            }
        }
        console.log('');
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
