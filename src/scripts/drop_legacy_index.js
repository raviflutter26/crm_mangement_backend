const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dropIndex = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collection = db.collection('organizations');

        console.log('Checking indexes on organizations collection...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const indexExists = indexes.some(idx => idx.name === 'organizationId_1');

        if (indexExists) {
            console.log('Dropping index organizationId_1...');
            await collection.dropIndex('organizationId_1');
            console.log('Index dropped successfully.');
        } else {
            console.log('Index organizationId_1 not found. Nothing to drop.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error dropping index:', error);
        process.exit(1);
    }
};

dropIndex();
