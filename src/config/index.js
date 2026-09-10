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

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

/**
 * Secrets have no safe default. A fallback like 'default_secret' means one
 * missing environment variable silently downgrades the system to forgeable
 * tokens, so refuse to boot instead.
 */
const requireSecret = (name, value) => {
  if (value) return value;
  throw new Error(
    `Missing required environment variable ${name}. ` +
    `Set it in .env (local) or in the host's environment (production) before starting the server.`
  );
};

const mongodbUri = getEnv('MONGODB_URI') || getEnv('MONGO_URL') || getEnv('DATABASE_URL');

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  env,
  isProduction,

  // MongoDB
  mongodbUri: requireSecret('MONGODB_URI', mongodbUri),

  // JWT
  jwt: {
    secret: requireSecret('JWT_SECRET', process.env.JWT_SECRET),
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
    origin: (origin, callback) => {
      // Allow all origins outside production for easier debugging (dev tunnels etc.).
      // Never in production, where NODE_ENV must be set explicitly.
      if (!isProduction) {
        return callback(null, true);
      }
      // Same-origin / non-browser callers send no Origin header.
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'https://crm-mangement-website-eight.vercel.app',
        process.env.WEBSITE_URL,
        process.env.MARKETING_SITE_URL
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked for origin: ${origin}`);
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

// Features that degrade rather than fail: warn once at boot so a misconfigured
// deploy is visible in the logs instead of surfacing as a runtime 500.
const optionalWarnings = [
  ['ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, 'bank account numbers cannot be encrypted or decrypted'],
  ['EMAIL_HOST', process.env.EMAIL_HOST, 'outbound email (payslips, approvals) will not send'],
  ['WEBSITE_URL', process.env.WEBSITE_URL, 'email action links will be broken'],
];

if (isProduction) {
  for (const [name, value, effect] of optionalWarnings) {
    if (!value) console.warn(`⚠️  ${name} is not set — ${effect}.`);
  }
}

module.exports = config;
