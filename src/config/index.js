const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ravi_zoho',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Zoho
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    redirectUri: process.env.ZOHO_REDIRECT_URI,
    orgId: process.env.ZOHO_ORG_ID,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    peopleBaseUrl: process.env.ZOHO_PEOPLE_BASE_URL || 'https://people.zoho.com/people/api',
    payrollBaseUrl: process.env.ZOHO_PAYROLL_BASE_URL || 'https://payroll.zoho.com/api/v1',
  },

  // CORS
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        process.env.WEBSITE_URL || 'http://localhost:3000',
      ];

      // Allow dev tunnel URLs and any origin in development
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
  },
};

module.exports = config;
