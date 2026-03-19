const mongoose = require('mongoose');
require('dotenv').config({ path: '/Users/empid016/Documents/Ravi/ravi_zoho/backend/.env' });

const userSchema = new mongoose.Schema({ email: String, role: String });
const empSchema = new mongoose.Schema({ email: String, role: String });

const User = mongoose.model('UserFix', userSchema, 'users');
const Employee = mongoose.model('EmployeeFix', empSchema, 'solar_employees');

async function fix() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        
        const email = 'senthil.kumar@sunrisesolar.tn';
        
        const u = await User.findOneAndUpdate({ email }, { role: 'Admin' }, { new: true });
        console.log('Updated User:', u?.email, 'Role:', u?.role);
        
        const e = await Employee.findOneAndUpdate({ email }, { role: 'Admin' }, { new: true });
        console.log('Updated Employee:', e?.email, 'Role:', e?.role);
        
        await mongoose.disconnect();
        console.log('Done!');
    } catch (err) {
        console.error(err);
    }
}

fix();
