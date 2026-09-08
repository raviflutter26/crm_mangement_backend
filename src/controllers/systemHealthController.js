const mongoose = require('mongoose');
const os = require('os');
const AuditLog = require('../models/AuditLog');

/** Human-readable process uptime, e.g. "3d 4h 12m". */
const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

/**
 * @desc    Get system health metrics
 * @route   GET /api/system/health
 * @access  Private (Superadmin)
 */
exports.getSystemHealth = async (req, res, next) => {
    try {
        // 1. Database Health
        const dbStatus = mongoose.connection.readyState === 1 ? 'Operational' : 'Disconnected';
        const dbLatencyStart = Date.now();
        await mongoose.connection.db.admin().ping();
        const dbLatency = Date.now() - dbLatencyStart;

        // 2. Infrastructure Metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = ((usedMem / totalMem) * 100).toFixed(1);

        const cpuLoad = os.loadavg(); // [1m, 5m, 15m]
        const uptime = process.uptime();

        // 3. Service dependency grid — only services this system actually uses,
        // and only statuses that were really measured. The previous list reported
        // Stripe, Auth0, S3 and SendGrid as 'Healthy' although none are wired in,
        // which made the dashboard look green regardless of reality.
        const services = [
            {
                id: 'mongodb',
                name: 'Primary Database',
                status: dbStatus === 'Operational' ? 'Healthy' : 'Degraded',
                latency: `${dbLatency}ms`,
            },
        ];

        // Redis backs rate limiting and job queues; report it only if configured.
        if (process.env.REDIS_URL || process.env.REDIS_HOST) {
            services.push({
                id: 'redis',
                name: 'Redis Cache',
                status: 'Unknown',
                latency: null,
                note: 'Configured, not probed by this endpoint',
            });
        }

        // Outbound mail
        services.push({
            id: 'smtp',
            name: 'Outbound Email',
            status: process.env.EMAIL_HOST ? 'Configured' : 'Not configured',
            latency: null,
        });

        // Salary payouts
        services.push({
            id: 'razorpay',
            name: 'RazorpayX Payouts',
            status: process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured',
            latency: null,
        });

        // 4. Real Security Logs from AuditLog
        const dbSecurityLogs = await AuditLog.find({ 
            action: { $in: ['Login', 'Logout', 'Password Reset', 'Organization Created', 'User Role Updated'] } 
        })
        .populate('userId', 'email firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5);

        const securityLogs = dbSecurityLogs.map(log => ({
            id: log._id,
            event: log.action,
            user: log.userId ? log.userId.email : (log.details?.actor || 'System'),
            status: 'Success', // Can be refined if logs track failures
            timestamp: log.createdAt
        }));

        res.status(200).json({
            success: true,
            data: {
                status: dbStatus === 'Operational' ? 'All Systems Operational' : 'Partial System Outage',
                // Real process uptime rather than an invented SLA figure.
                uptime: formatUptime(uptime),
                activeIncidents: dbStatus === 'Operational' ? 0 : 1,
                metrics: {
                    cpuLoad: cpuLoad[0].toFixed(2),
                    memUsage: `${memUsage}%`,
                    // Not tracked yet — null renders as "—" instead of a fake 0.01%.
                    errorRate: null,
                    requestLatency: `${dbLatency}ms`,
                    uptimeSeconds: uptime
                },
                services,
                securityLogs,
                deployment: {
                    // Injected at build/deploy time; null when unknown, never invented.
                    version: process.env.APP_VERSION || null,
                    hash: process.env.GIT_COMMIT_SHA || null,
                    deployedAt: process.env.DEPLOYED_AT || null
                }
            }
        });
    } catch (error) {
        next(error);
    }
};
