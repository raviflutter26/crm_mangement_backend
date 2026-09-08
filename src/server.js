const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const connectDB = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { UPLOAD_ROOT } = require('./middleware/upload');
const PayrollScheduler = require('./scheduler/payrollCron');
const AttendanceScheduler = require('./scheduler/attendanceCron');

const app = express();

// Schedulers are started in startServer(), after the DB connection is up.
// Initialising them here as well registered every cron twice, which risked
// running a payroll twice for the same month.

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

// ============== START SERVER ==============

let server;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start the schedulers once, after the DB is reachable
        PayrollScheduler.init();
        AttendanceScheduler.init();

        server = app.listen(config.port, () => {
            console.log(`
╔══════════════════════════════════════════════╗
║  🚀 Ravi Zoho HR & Payroll API Server       ║
║  ─────────────────────────────────────────   ║
║  Port:        ${config.port}                          ║
║  Environment: ${config.env.padEnd(30)}║
║  MongoDB:     Connected ✅                   ║
╚══════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

/**
 * Stop accepting new connections, let in-flight requests finish, then exit.
 * Without this, a container restart can kill a request mid-payroll-write.
 */
const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    if (!server) process.exit(0);

    server.close(() => {
        console.log('✅ HTTP server closed.');
        process.exit(0);
    });

    // Don't hang forever on a stuck connection
    setTimeout(() => {
        console.error('⏱  Shutdown timed out — forcing exit.');
        process.exit(1);
    }, 15000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// An unhandled rejection or uncaught exception leaves the process in an unknown
// state. Log it, then exit so the host restarts a clean one.
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled promise rejection:', reason);
    shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

startServer();

module.exports = app;
