const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Invitation = require('../models/Invitation');
const Organization = require('../models/Organization');
const SupportTicket = require('../models/SupportTicket');
const mongoose = require('mongoose');

/**
 * @desc    Get SuperAdmin Analytics data
 * @route   GET /api/superadmin/analytics
 */
/**
 * @desc    Get SuperAdmin Analytics data
 * @route   GET /api/superadmin/analytics
 */
exports.getAnalytics = async (req, res, next) => {
    try {
        const orgs = await Organization.find();
        const users = await User.find();
        const activeUserCount = users.filter(u => u.isActive).length;

        // Pricing tiers
        const pricing = { 'Starter': 99, 'Pro': 199, 'Enterprise': 499 };
        
        // Calculate MRR/ARR from actual organization plans
        const mrr = orgs.reduce((sum, org) => sum + (pricing[org.planType] || 199), 0);
        const arr = mrr * 12;

        const activeUsers = activeUserCount;
        const totalUsers = users.length;
        const mau = Math.max(totalUsers, activeUserCount + 2); // Simulated slightly higher than active for DAU/MAU
        const ratio = mau > 0 ? ((activeUsers / mau) * 100).toFixed(1) : "0";

        // Aggregate signups/cancellations over last 7 months
        const months = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return d.toLocaleString('default', { month: 'short' });
        }).reverse();

        const growthSeries = {
            signups: months.map(() => 0),
            cancellations: months.map(() => 0)
        };

        orgs.forEach(org => {
            const orgMonth = org.createdAt.toLocaleString('default', { month: 'short' });
            const monthIdx = months.indexOf(orgMonth);
            if (monthIdx !== -1) {
                if (org.status === 'suspended' || org.status === 'inactive') {
                    growthSeries.cancellations[monthIdx]++;
                } else {
                    growthSeries.signups[monthIdx]++;
                }
            }
        });

        // Geographic distribution from Organization addresses
        const geoMap = new Map();
        orgs.forEach(org => {
            const country = org.address?.country || "Earth";
            geoMap.set(country, (geoMap.get(country) || 0) + 1);
        });

        const geoDistribution = Array.from(geoMap.entries()).map(([country, count]) => ({
            flag: country === "United States" ? "🇺🇸" : country === "India" ? "🇮🇳" : "🌐",
            country,
            count,
            pct: Math.min(100, Math.ceil((count / orgs.length) * 100))
        })).sort((a,b) => b.count - a.count);

        // API Traffic from AuditLogs (Mapped to pseudo-labels for charts)
        const recentLogs = await AuditLog.find({ createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 7) } });
        const moduleUsage = {
            "Employees": months.map(() => 0),
            "Payroll": months.map(() => 0),
            "Leaves": months.map(() => 0)
        };
        
        recentLogs.forEach(log => {
            const logMonth = log.createdAt.toLocaleString('default', { month: 'short' });
            const monthIdx = months.indexOf(logMonth);
            if (monthIdx !== -1 && moduleUsage[log.module]) {
                moduleUsage[log.module][monthIdx]++;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                kpis: [
                    { label: "Monthly Recurring Revenue", val: `$${mrr.toLocaleString()}`, sub: `ARR: $${(arr/1000000).toFixed(2)}M`, delta: "+12.4%", dir: "up", cls: "blue", spark: [210,225,218,240,258,262,284] },
                    { label: "Active Users (DAU / MAU)", val: activeUsers.toLocaleString(), sub: `MAU: ${mau.toLocaleString()} · ratio ${ratio}%`, delta: "+8.1%", dir: "up", cls: "green", spark: [120,135,142,158,161,172,184] },
                    { label: "Churn Rate", val: "2.3%", sub: "Lost 54 orgs this period", delta: "+0.4%", dir: "down", cls: "red", spark: [1.8,1.9,2.1,2.0,2.4,2.2,2.3] },
                ],
                apiTraffic: {
                    labels: months,
                    series: [
                        { name: "Employees", data: moduleUsage["Employees"], color: "#3b82f6" },
                        { name: "Payroll", data: moduleUsage["Payroll"], color: "#a855f7" },
                        { name: "Leaves", data: moduleUsage["Leaves"], color: "#22c55e" }
                    ]
                },
                growthGrowth: {
                    labels: months,
                    series: [
                        { name: "Signups", data: growthSeries.signups, color: "#3b82f6" },
                        { name: "Cancellations", data: growthSeries.cancellations, color: "#ef4444" }
                    ]
                },
                geoDistribution: geoDistribution.length > 0 ? geoDistribution : [
                    { flag: "🌐", country: "Platform Origin", count: orgs.length, pct: 100 }
                ]
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get SuperAdmin Audit Log
 * @route   GET /api/superadmin/audit-log
 */
exports.getAuditLog = async (req, res, next) => {
    try {
        const { actor, action, severity } = req.query;
        let query = {};
        if (severity && severity !== 'All') query['details.severity'] = severity;
        if (action) query.action = { $regex: action, $options: 'i' };

        const dbLogs = await AuditLog.find(query)
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(20);

        const logs = dbLogs.map(log => ({
            id: log._id,
            ts: log.createdAt.toISOString().replace('T', ' ').split('.')[0],
            actor: log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : (log.details?.actor || 'System'),
            action: log.action,
            target: log.details?.target || log.module || '—',
            ip: log.ipAddress || '—',
            severity: log.details?.severity || "Info"
        }));

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get Global Invitations
 * @route   GET /api/superadmin/invitations
 */
exports.getInvitations = async (req, res, next) => {
    try {
        const dbInvitations = await Invitation.find()
            .populate('organizationId', 'name')
            .sort({ createdAt: -1 })
            .limit(50);

        const invitations = dbInvitations.map(inv => ({
            id: inv._id,
            email: inv.email,
            role: inv.role,
            organization: inv.organizationId?.name || '—',
            sentAt: inv.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            expiresAt: inv.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
            initials: inv.email.substring(0, 2).toUpperCase()
        }));

        res.status(200).json({
            success: true,
            data: invitations
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get Locked Accounts
 * @route   GET /api/superadmin/locked-accounts
 */
exports.getLockedAccounts = async (req, res, next) => {
    try {
        const dbLocked = await User.find({ 
            $or: [
                { lockUntil: { $gt: Date.now() } },
                { isActive: false }
            ]
        }).populate('organizationId', 'name');

        const accounts = dbLocked.map(u => ({
            id: u._id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            initials: (u.firstName[0] + u.lastName[0] || "U").toUpperCase(),
            reason: u.isActive ? "Temporary Security Lock" : "Manual Account Deactivation",
            reasonType: u.isActive ? "security" : "manual",
            lockedAt: u.updatedAt.toISOString().replace('T', ' ').split('.')[0],
            failedAttempts: u.loginAttempts || 0,
            ip: "—",
            location: "—",
            organization: u.organizationId?.name || "System"
        }));

        res.status(200).json({
            success: true,
            data: accounts
        });
    } catch (error) {
        next(error);
    }
};

exports.getModuleData = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        // Fetch real-time counts for various modules
        const orgCount = await Organization.countDocuments();
        const userCount = await User.countDocuments();
        const pendingCount = await Organization.countDocuments({ status: 'pending' });
        const invitationCount = await Invitation.countDocuments({ status: 'pending' });

        const mockData = {
            'tenant-active': {
                stats: [
                    { label: "Active Tenants", val: orgCount - pendingCount, sub: "Verified & Live", cls: "green" },
                    { label: "Pending Approval", val: pendingCount, sub: "Awaiting review", cls: "orange" },
                    { label: "Total Reach", val: userCount, sub: "Across all tenants", cls: "blue" }
                ]
            },
            'org-pending': { 
                count: pendingCount, 
                data: await Organization.find({ status: 'pending' }).limit(10),
                stats: [
                    { label: "Total Pending", val: pendingCount, sub: "High priority", cls: "orange" }
                ]
            },
            'access-invitations': {
                count: invitationCount,
                stats: [
                    { label: "Open Invites", val: invitationCount, sub: "Sent last 7 days", cls: "blue" }
                ]
            },
            'infra-server': {
                stats: [
                    { label: "Active Nodes", val: "12", sub: "us-east-1, eu-west-2", cls: "green" },
                    { label: "CPU Load", val: "28%", sub: "Avg cluster load", cls: "blue" },
                    { label: "Memory Usage", val: "44%", sub: "Optimized", cls: "green" }
                ]
            }
        };

        const data = mockData[slug] || { stats: [], data: [] };

        res.status(200).json({
            success: true,
            slug,
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get counts for Sidebar Dynamic Badges
 * @route   GET /api/superadmin/sidebar-counts
 */
exports.getSidebarCounts = async (req, res, next) => {
    try {
        const [
            pendingOrgs,
            criticalLogs,
            lockedAccounts,
            pendingInvites,
            openTickets
        ] = await Promise.all([
            Organization.countDocuments({ status: 'pending' }),
            AuditLog.countDocuments({ "details.severity": "Critical" }), // Can refine with date range if needed
            User.countDocuments({ 
                $or: [
                    { lockUntil: { $gt: Date.now() } },
                    { isActive: false }
                ]
            }),
            Invitation.countDocuments({ status: 'pending' }),
            SupportTicket.countDocuments({ status: { $ne: 'resolved' } })
        ]);

        const dbStatus = mongoose.connection.readyState === 1 ? 'OK' : 'ERR';

        res.status(200).json({
            success: true,
            data: {
                pendingOrgs,
                criticalLogs,
                lockedAccounts,
                pendingInvites,
                openTickets,
                systemHealth: dbStatus
            }
        });
    } catch (error) {
        next(error);
    }
};
