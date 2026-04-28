const axios = require('axios');
const loginAndInitiate = async () => {
    try {
        const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'admin@solar.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        
        const initRes = await axios.post('http://localhost:5001/api/payroll-runs/initiate', {
            month: 4,
            year: 2026
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Success:", initRes.data);
    } catch (e) {
        console.error("Error:", e.response?.data || e.message);
    }
}
loginAndInitiate();
