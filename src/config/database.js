const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
    if (!config.mongodbUri) {
        console.error('❌ MongoDB Connection Error: MONGODB_URI is not defined in environment variables.');
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(config.mongodbUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
