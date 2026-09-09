/**
 * Builds and configures the Express application.
 *
 * Deliberately does NOT connect to MongoDB, start schedulers, or listen on a
 * port — those belong to server.js. Keeping them apart is what lets tests
 * require this module and drive it with supertest without booting a real
 * server or touching the production database.
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { UPLOAD_ROOT } = require('./middleware/upload');

const app = express();

// Schedulers, the email worker and the DB connection all belong to
// server.js — they are process-level concerns, and starting them here would
// register every cron twice (risking a payroll running twice for one month)
// as well as making this module impossible to import from a test.

// Trust proxy to resolve 'X-Forwarded-For' error with express-rate-limit behind proxies/tunnels
app.set('trust proxy', 1);

// Outside production, list the environment variable names in play (never values)
// to make a misconfigured local/staging setup obvious.
if (!config.isProduction) {
    console.log('🔍 Detected Environment Variables:',
        Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('PASS') && !k.includes('KEY')).join(', ')
    );
}

// ============== MIDDLEWARE ==============

// Security headers
app.use(helmet());

// Debug: Log incoming request info in development
if (config.env === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'No Origin'}`);
        next();
    });
}

// CORS
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Serve uploaded files (employee documents, receipts, etc.)
//
// ACCEPTED RISK (reviewed, deliberate): these files are served without
// authentication, so anyone holding a URL can read the document — including
// employee ID proofs and contracts. Protection today is filename entropy only
// (timestamp + 16 random bytes), which is obscurity, not access control.
//
// Serving them behind auth needs a frontend change, because the session token
// lives in localStorage and a browser <img>/<a> request cannot attach an
// Authorization header. The two viable fixes are short-lived signed URLs, or
// moving the token to a cookie and replacing this with an org-scoped download
// route. Revisit before this system holds documents for employees outside the
// organizations that already trust each other.
app.use('/uploads', express.static(UPLOAD_ROOT, {
    setHeaders: (res) => {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit for dev
    message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Express 5 leaves req.body undefined when a request carries no body, where
// Express 4 set it to {}. Handlers here read req.body freely (53 unguarded
// destructurings across 34 controllers), so a body-less POST/PATCH — which is
// exactly how the frontend calls approve, lock and pay — threw a TypeError and
// returned 500. Restoring the empty object closes that whole class of failure.
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});

// Cookie parser
app.use(cookieParser());

// Logging
if (config.env === 'development') {
    app.use(morgan('dev'));
}

// ============== ROUTES ==============

app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 Ravi Zoho HR & Payroll API',
        version: '1.0.0',
        docs: '/api/health',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// Error handler
app.use(errorHandler);

module.exports = app;
