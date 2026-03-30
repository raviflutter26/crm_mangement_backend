const mongoose = require('mongoose');
const config = require('./config');

const fix = async () => {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to DB');
        
        try {
            await mongoose.connection.collection('salarytemplates').dropIndex('name_1');
            console.log('Successfully dropped old name_1 index');
        } catch (e) {
            console.log('Index name_1 not found or already dropped');
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fix();
