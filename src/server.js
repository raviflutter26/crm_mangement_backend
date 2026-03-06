const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const connectDB = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust proxy to resolve 'X-Forwarded-For' error with express-rate-limit behind proxies/tunnels
app.set('trust proxy', 1);

// ============== MIDDLEWARE ==============

// Security headers
app.use(helmet());

// CORS
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        app.listen(config.port, () => {
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

startServer();

module.exports = app;
