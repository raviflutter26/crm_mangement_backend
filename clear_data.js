const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function clearData() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined in .env');

        console.log('🗑️  Connecting to MongoDB to clear data...');
        await mongoose.connect(uri);
        console.log('✅ Connected!');

        // Define models/collections to clear
        // Note: Using raw collection names to ensure everything is wiped
        const collections = [
            'solar_employees',
            'attendances',
            'payrolls',
            'leaves',
            'payrollruns',
            'payroll_reports',
            'auditlogs',
            'expenses',
            'assets',
            'payouttransactions',
            'notifications',
            'bankdetails'
        ];

        for (const collName of collections) {
            const count = await mongoose.connection.db.collection(collName).countDocuments();
            if (count > 0) {
                console.log(`Deleting ${count} records from ${collName}...`);
                await mongoose.connection.db.collection(collName).deleteMany({});
                console.log(`✅ ${collName} cleared!`);
            } else {
                console.log(`ℹ️  ${collName} is already empty.`);
            }
        }

        console.log('\n✨ Database cleanup complete! ✨');
        console.log('Your dashboard should now show 0 employees, 0 payroll, and 0 attendance.');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during cleanup:', err.message);
        process.exit(1);
    }
}

clearData();
