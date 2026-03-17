const mongoose = require('mongoose');
const Attendance = require('./src/models/Attendance');
const Employee = require('./src/models/Employee');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho';

async function seedFebAttendance() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const employees = await Employee.find({});
        console.log(`Found ${employees.length} employees to seed.`);

        const statuses = ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Absent', 'Half Day', 'WFH', 'Present'];
        
        let recordsCreated = 0;
        
        // Days in Feb 2026 (28 days). Let's seed Mon-Fri
        for (let day = 1; day <= 28; day++) {
            const date = new Date(2026, 1, day); // Month is 0-indexed, so 1 = Feb
            const dayOfWeek = date.getDay();
            
            // Skip weekends
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            for (const emp of employees) {
                // Determine a random status
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                let checkInTime = null;
                let checkOutTime = null;
                let isLate = false;
                let lateBy = 0;
                let totalHours = 0;
                let sessions = [];
                
                if (randomStatus === 'Present') {
                    // Check in around 9:00 AM (maybe slightly before or after)
                    const checkInOffset = Math.floor(Math.random() * 60) - 15; // -15 to +45 minutes
                    checkInTime = new Date(date);
                    checkInTime.setHours(9, checkInOffset, 0, 0);
                    
                    if (checkInOffset > 30) {
                        isLate = true;
                        lateBy = checkInOffset - 30; // Based on 9:30 cutoff
                    }
                    
                    // Check out around 6:30 PM (maybe slightly before or after)
                    const checkOutOffset = Math.floor(Math.random() * 60) - 15; // -15 to +45
                    checkOutTime = new Date(date);
                    checkOutTime.setHours(18, 30 + checkOutOffset, 0, 0);
                    
                    totalHours = parseFloat(((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2));
                    sessions = [{ checkIn: checkInTime, checkOut: checkOutTime, hours: totalHours }];
                } else if (randomStatus === 'Half Day') {
                    checkInTime = new Date(date);
                    checkInTime.setHours(9, 0, 0, 0);
                    
                    checkOutTime = new Date(date);
                    checkOutTime.setHours(13, 0, 0, 0);
                    
                    totalHours = 4;
                    sessions = [{ checkIn: checkInTime, checkOut: checkOutTime, hours: 4 }];
                } else if (randomStatus === 'WFH') {
                    checkInTime = new Date(date);
                    checkInTime.setHours(9, 0, 0, 0);
                    checkOutTime = new Date(date);
                    checkOutTime.setHours(18, 30, 0, 0);
                    totalHours = 9.5;
                    sessions = [{ checkIn: checkInTime, checkOut: checkOutTime, hours: 9.5 }];
                }
                
                // Keep record
                const newRecord = {
                    employee: emp._id,
                    date: date,
                    checkIn: checkInTime,
                    checkOut: checkOutTime,
                    sessions: sessions,
                    status: randomStatus,
                    source: 'system',
                    totalHours: totalHours,
                    isLate: isLate,
                    lateBy: lateBy
                };
                
                // Overwrite if exists, else insert
                await Attendance.findOneAndUpdate(
                    { employee: emp._id, date: date },
                    newRecord,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                
                recordsCreated++;
            }
        }

        console.log(`Successfully generated ${recordsCreated} mock attendance records for Feb 2026.`);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedFebAttendance();
