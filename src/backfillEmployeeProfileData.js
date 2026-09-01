/**
 * One-off backfill: fills in realistic placeholder profile data (personal info, address,
 * PAN/Aadhaar, bank details, salary structure, PF/ESI) for seeded Users that only ever got
 * name/email/role/department from seedSampleOrgHierarchy.js. Only touches fields that are
 * currently empty/null/zero — never overwrites real data someone already entered.
 *
 * Usage:
 *   node src/backfillEmployeeProfileData.js            # dry run (default) - no writes
 *   node src/backfillEmployeeProfileData.js --commit    # actually writes
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

const COMMIT = process.argv.includes('--commit');

const GENDER_MAP = {
    'karthikeyan.subramaniam@cauverytech.test': 'Male',
    'meena.rajan@cauverytech.test': 'Female',
    'arun.krishnan@cauverytech.test': 'Male',
    'selvam.murugan@cauverytech.test': 'Male',
    'priya.nadar@cauverytech.test': 'Female',
    'vignesh.iyer@cauverytech.test': 'Male',
    'lakshmi.chettiar@cauverytech.test': 'Female',
    'suresh.gounder@cauverytech.test': 'Male',
    'kavya.raman@cauverytech.test': 'Female',
    'dinesh.natarajan@cauverytech.test': 'Male',
    'senthil.velu@cauverytech.test': 'Male',
    'divya.sundaram@cauverytech.test': 'Female',
    'ganesh.balasubramaniam@cauverytech.test': 'Male',
    'anitha.ramasamy@cauverytech.test': 'Female',
    'rajesh.muthusamy@nilgirisindustries.test': 'Male',
    'sangeetha.manickam@nilgirisindustries.test': 'Female',
    'bala.palaniappan@nilgirisindustries.test': 'Male',
    'nithya.sivakumar@nilgirisindustries.test': 'Female',
    'prakash.iyengar@nilgirisindustries.test': 'Male',
    'deepa.pillai@nilgirisindustries.test': 'Female',
    'kumaresan.rajan@nilgirisindustries.test': 'Male',
    'revathi.krishnan@nilgirisindustries.test': 'Female',
    'elango.nadar@nilgirisindustries.test': 'Male',
    'kalaivani.chettiar@nilgirisindustries.test': 'Female',
    'manikandan.gounder@nilgirisindustries.test': 'Male',
    'shanthi.raman@nilgirisindustries.test': 'Female',
    'sathish.natarajan@nilgirisindustries.test': 'Male',
    'uma.velu@nilgirisindustries.test': 'Female',
};

const CITY_BY_DOMAIN = {
    'cauverytech.test': { city: 'Coimbatore', pincodeBase: 641001 },
    'nilgirisindustries.test': { city: 'Udhagamandalam', pincodeBase: 643001 },
};

const BANKS = [
    { name: 'HDFC Bank', ifscPrefix: 'HDFC0' },
    { name: 'ICICI Bank', ifscPrefix: 'ICIC0' },
    { name: 'State Bank of India', ifscPrefix: 'SBIN0' },
    { name: 'Axis Bank', ifscPrefix: 'UTIB0' },
    { name: 'Kotak Mahindra Bank', ifscPrefix: 'KKBK0' },
];

const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B+', 'O+', 'B-'];

const SALARY_TIERS = {
    admin: { basic: 60000, hra: 24000, da: 6000, ta: 2000, specialAllowance: 8000 },
    hr: { basic: 35000, hra: 14000, da: 3500, ta: 1500, specialAllowance: 4500 },
    manager: { basic: 40000, hra: 16000, da: 4000, ta: 1500, specialAllowance: 5500 },
    employee: { basic: 13000, hra: 5200, da: 800, ta: 500, specialAllowance: 500 },
};

function seededRandomInt(seedStr, min, max) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    return min + (hash % (max - min + 1));
}

function padNum(n, len) {
    return String(n).padStart(len, '0');
}

function genPan(seedStr, index) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const l = (n) => letters[n % 26];
    const base = seededRandomInt(seedStr, 0, 999999);
    return `${l(base)}${l(base >> 3)}${l(base >> 6)}${l(base >> 9)}${l(base >> 12)}${padNum(1000 + (index * 37) % 9000, 4)}${l(index)}`;
}

function genAadhaar(index) {
    return padNum(200000000000 + index * 137, 12);
}

function genUan(index) {
    return padNum(100200300000 + index * 91, 12);
}

async function main() {
    console.log(`Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const emails = Object.keys(GENDER_MAP);
    const users = await User.find({ email: { $in: emails } });
    console.log(`Found ${users.length} of ${emails.length} target users.`);

    let index = 0;
    for (const user of users) {
        index++;
        const domain = user.email.split('@')[1];
        const cityInfo = CITY_BY_DOMAIN[domain] || { city: 'Chennai', pincodeBase: 600001 };
        const roleTierKey = ['admin', 'hr', 'manager'].includes(user.role) ? user.role : 'employee';
        const tier = SALARY_TIERS[roleTierKey];
        const gender = GENDER_MAP[user.email] || 'Male';
        const bank = BANKS[index % BANKS.length];

        const changes = [];

        if (!user.gender) { user.gender = gender; changes.push('gender'); }
        if (!user.maritalStatus) {
            const age = seededRandomInt(user.email, 24, 52);
            user.maritalStatus = age >= 28 ? 'Married' : 'Single';
            changes.push('maritalStatus');
        }
        if (!user.dateOfBirth) {
            const age = { admin: 46, hr: 35, manager: 38, employee: 27 }[roleTierKey] + seededRandomInt(user.email + 'age', -3, 3);
            const dob = new Date();
            dob.setFullYear(dob.getFullYear() - age);
            dob.setMonth(seededRandomInt(user.email + 'm', 0, 11));
            dob.setDate(seededRandomInt(user.email + 'd', 1, 28));
            user.dateOfBirth = dob;
            changes.push('dateOfBirth');
        }
        if (!user.bloodGroup) { user.bloodGroup = BLOOD_GROUPS[index % BLOOD_GROUPS.length]; changes.push('bloodGroup'); }
        if (!user.location) { user.location = cityInfo.city; changes.push('location'); }

        if (!user.address || !user.address.currentAddress) {
            const doorNo = seededRandomInt(user.email + 'door', 1, 199);
            const streetNo = seededRandomInt(user.email + 'street', 1, 20);
            const addr = `${doorNo}, ${streetNo}th Cross Street, ${cityInfo.city}`;
            user.address = {
                currentAddress: addr,
                permanentAddress: addr,
                city: cityInfo.city,
                state: 'Tamil Nadu',
                country: 'India',
                zipCode: String(cityInfo.pincodeBase + (index % 20)),
                pincode: String(cityInfo.pincodeBase + (index % 20)),
            };
            changes.push('address');
        }

        if (!user.panNumber) { user.panNumber = genPan(user.email, index); changes.push('panNumber'); }
        if (!user.aadhaar) { user.aadhaar = genAadhaar(index); changes.push('aadhaar'); }
        if (index % 3 === 0 && !user.passportNumber) { user.passportNumber = `N${padNum(1000000 + index * 113, 7)}`; changes.push('passportNumber'); }
        if (index % 2 === 0 && !user.drivingLicense) { user.drivingLicense = `TN37 ${new Date().getFullYear() - 5}${padNum(index * 341, 7)}`; changes.push('drivingLicense'); }

        const hasBank = user.bankDetails && (user.bankDetails.bankName || user.bankDetails.encryptedAccountNumber);
        if (!hasBank) {
            user.bankDetails = user.bankDetails || {};
            user.bankDetails.accountHolderName = `${user.firstName} ${user.lastName}`;
            user.bankDetails.bankName = bank.name;
            user.bankDetails.ifscCode = `${bank.ifscPrefix}${padNum(index * 7, 6)}`;
            user.bankDetails.branchName = `${cityInfo.city} Branch`;
            user.bankDetails.upiId = `${user.firstName.toLowerCase()}.${user.lastName.toLowerCase()}@okhdfcbank`;
            user.bankDetails.verificationStatus = 'Verified';
            user.bankDetails.accountNumber = String(seededRandomInt(user.email + 'acct', 100000000000, 999999999999));
            changes.push('bankDetails');
        }

        const hasSalary = user.salary && user.salary.basic > 0;
        if (!hasSalary) {
            const gross = tier.basic + tier.hra + tier.da + tier.ta + tier.specialAllowance;
            user.salary = {
                basic: tier.basic,
                hra: tier.hra,
                da: tier.da,
                ta: tier.ta,
                specialAllowance: tier.specialAllowance,
                grossSalary: gross,
                netSalary: Math.round(gross * 0.88),
            };
            user.ctc = Math.round(gross * 12 * 1.15);
            changes.push('salary+ctc');
        }

        if (!user.statutory) user.statutory = {};
        if (!user.statutory.pf) user.statutory.pf = {};
        if (!user.statutory.pf.uanNumber) {
            user.statutory.pf.uanNumber = genUan(index);
            user.statutory.pf.pfNumber = `TN/CBE/${padNum(1234567 + index, 7)}/000${padNum(index, 3)}`;
            user.statutory.pf.pfJoiningDate = user.dateOfJoining || new Date();
            changes.push('statutory.pf');
        }

        if (!user.statutory.esi) user.statutory.esi = {};
        const grossForEsi = (user.salary && user.salary.grossSalary) || 0;
        const esiEligible = grossForEsi > 0 && grossForEsi <= 21000;
        if (user.statutory.esi.esiNumber === undefined || user.statutory.esi.esiNumber === null) {
            if (esiEligible) {
                user.statutory.esi.enabled = true;
                user.statutory.esi.esiNumber = padNum(3101234500 + index, 10);
                user.statutory.esi.dispensary = `${cityInfo.city} ESIC Dispensary`;
            } else {
                user.statutory.esi.enabled = false;
                user.statutory.esi.esiNumber = null;
                user.statutory.esi.dispensary = null;
            }
            changes.push('statutory.esi');
        }

        console.log(`${user.email}: ${changes.length ? changes.join(', ') : '(already complete, no changes)'}`);

        if (COMMIT && changes.length) {
            await user.save();
        }
    }

    console.log(`\n${COMMIT ? 'Committed' : 'Would commit'} changes for ${users.length} users.`);
    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
