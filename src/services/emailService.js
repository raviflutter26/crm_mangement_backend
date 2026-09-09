const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');

// Redis configuration
const redisTarget = config.redis.url || {
    host: config.redis.host,
    port: config.redis.port,
};

// `new Redis()` takes either a URL string or an options object, so normalize the
// two shapes into one call signature before layering per-role options on top.
const redisArgs = (extra) =>
    typeof redisTarget === 'string' ? [redisTarget, extra] : [{ ...redisTarget, ...extra }];

// How long a producer may wait to hand a job to Redis before giving up. Email is
// never worth holding an HTTP response open for.
const ENQUEUE_TIMEOUT_MS = Number(process.env.EMAIL_ENQUEUE_TIMEOUT_MS || 5000);

/**
 * Redis and BullMQ are created on first use rather than at import.
 *
 * Importing this module used to open a Redis socket and start a polling
 * Worker as a side effect, so any process that merely required a controller
 * — a script, a test run — held two live sockets it never asked for and
 * could not exit. It also logged connection errors on machines with no Redis
 * at all.
 */
let connection = null;
let producerConnection = null;
let emailQueue = null;
let emailWorker = null;

const getConnection = () => {
    if (!connection) {
        // BullMQ requires maxRetriesPerRequest: null on the blocking connection a
        // Worker uses, so this one must retry indefinitely.
        connection = new Redis(...redisArgs({ maxRetriesPerRequest: null }));
        // Handle Redis connection errors to prevent process crash
        connection.on('error', (err) => {
            console.error('❌ Redis Connection Error:', err.message);
        });
    }
    return connection;
};

/**
 * Separate connection for enqueueing.
 *
 * The Worker's connection retries forever by design, but a producer must never
 * inherit that: with an unreachable Redis, ioredis buffers the command in its
 * offline queue and `queue.add()` never settles, so a request that awaits it
 * hangs until the client times out — the caller sees a failure even though its
 * own work already committed. These options make enqueueing fail fast instead.
 */
const getProducerConnection = () => {
    if (!producerConnection) {
        producerConnection = new Redis(...redisArgs({
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            connectTimeout: ENQUEUE_TIMEOUT_MS,
            retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
        }));
        producerConnection.on('error', (err) => {
            console.error('❌ Redis Producer Connection Error:', err.message);
        });
    }
    return producerConnection;
};

const getQueue = () => {
    if (!emailQueue) emailQueue = new Queue('emailQueue', { connection: getProducerConnection() });
    return emailQueue;
};

// SMTP Transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Compile Handlebars template
 */
const getCompiledTemplate = async (templateName, data) => {
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    return template({
        ...data,
        companyName: process.env.COMPANY_NAME || 'Ravi Zoho HRMS',
        year: new Date().getFullYear(),
        websiteUrl: process.env.WEBSITE_URL,
    });
};

/**
 * Add email to queue
 */
const sendEmail = async ({ to, subject, template, data, attachments = [] }) => {
    try {
        const add = getQueue().add(`email-${template}-${Date.now()}`, {
            to,
            subject,
            template,
            data,
            attachments
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });

        // Belt and braces alongside the producer connection's fast-fail options: no
        // caller should ever be able to block on the queue indefinitely.
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`Timed out after ${ENQUEUE_TIMEOUT_MS}ms queueing email to ${to}`)),
                ENQUEUE_TIMEOUT_MS
            );
        });

        try {
            await Promise.race([add, timeout]);
        } finally {
            clearTimeout(timer);
        }
        console.log(`Email to ${to} queued successfully.`);
    } catch (error) {
        console.error('Error queuing email:', error);
        throw error;
    }
};

/**
 * Worker to process email queue
 */
const buildWorker = () => new Worker('emailQueue', async (job) => {
    const { to, subject, template, data, attachments } = job.data;
    
    try {
        console.log(`Processing email job for ${to}...`);
        const html = await getCompiledTemplate(template, data);

        const mailOptions = {
            from: `"${process.env.COMPANY_NAME || 'Ravi Zoho HRMS'}" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        throw error;
    }
}, { connection: getConnection() });

/**
 * Start processing queued emails. Called once from server.js, alongside the
 * schedulers — only the long-running server process should drain the queue.
 */
const startEmailWorker = () => {
    if (emailWorker) return emailWorker;
    emailWorker = buildWorker();

    emailWorker.on('completed', (job) => {
        console.log(`Email job ${job.id} completed!`);
    });

    emailWorker.on('failed', (job, err) => {
        console.error(`Email job ${job.id} failed with error ${err.message}`);
    });

    return emailWorker;
};

/**
 * Release the Redis socket and worker, if this process ever opened them, so it
 * can exit. Used by tests and one-off scripts.
 */
const closeEmail = async () => {
    if (emailWorker) { try { await emailWorker.close(); } catch { /* already closed */ } emailWorker = null; }
    if (emailQueue) { try { await emailQueue.close(); } catch { /* already closed */ } emailQueue = null; }
    // disconnect() rather than quit(): quit waits for a handshake that never
    // completes when Redis was never reachable.
    if (connection) { try { connection.disconnect(); } catch { /* already gone */ } connection = null; }
};

module.exports = {
    sendEmail,
    startEmailWorker,
    closeEmail,
    /** The queue, created on first access. Prefer sendEmail(). */
    get emailQueue() { return getQueue(); },
};
