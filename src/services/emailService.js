const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');

// Redis configuration
const redisConfig = config.redis.url || {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
};

const connection = new Redis(redisConfig, {
    maxRetriesPerRequest: null
});

// Handle Redis connection errors to prevent process crash
connection.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err.message);
});


// Initialize Email Queue
const emailQueue = new Queue('emailQueue', { connection });

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
        await emailQueue.add(`email-${template}-${Date.now()}`, {
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
        console.log(`Email to ${to} queued successfully.`);
    } catch (error) {
        console.error('Error queuing email:', error);
        throw error;
    }
};

/**
 * Worker to process email queue
 */
const emailWorker = new Worker('emailQueue', async (job) => {
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
}, { connection });

emailWorker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed!`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`Email job ${job.id} failed with error ${err.message}`);
});

module.exports = {
    sendEmail,
    emailQueue
};
