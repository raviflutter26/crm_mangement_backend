/**
 * Process entry point: connects the database, starts the schedulers, listens,
 * and handles shutdown. The Express app itself is built in app.js.
 */
const app = require('./app');
const config = require('./config');
const connectDB = require('./config/database');
const PayrollScheduler = require('./scheduler/payrollCron');
const AttendanceScheduler = require('./scheduler/attendanceCron');
const { startEmailWorker } = require('./services/emailService');

// ============== START SERVER ==============

let server;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start the schedulers once, after the DB is reachable
        PayrollScheduler.init();
        AttendanceScheduler.init();

        // The email queue is drained only by the server process. It used to
        // start on import, which meant every script and test run started a
        // worker too.
        startEmailWorker();

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
