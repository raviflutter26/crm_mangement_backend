const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Helper to get environment variables with fallback and case-insensitivity
const getEnv = (key, defaultValue) => {
  return process.env[key] || process.env[key.toUpperCase()] || process.env[key.toLowerCase()] || defaultValue;
};

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodbUri: getEnv('MONGODB_URI') || getEnv('MONGO_URL') || getEnv('DATABASE_URL'),

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

      if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  }
};

module.exports = config;
