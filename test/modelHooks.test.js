const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startDb, stopDb, clearDb } = require('../test-utils/testEnv');
const mongoose = require('mongoose');

/**
 * Regression cover for a Mongoose 9 upgrade break.
 *
 * Mongoose 9 removed the `next` callback style for middleware: a hook is now
 * invoked with no arguments and whatever it returns is awaited. Every hook
 * still written as `function (next) { ...; next(); }` therefore threw
 * "next is not a function" on save, making the affected documents impossible
 * to create at all. These tests save one of each so the breakage cannot
 * silently return.
 */
describe('model pre-save hooks run under Mongoose 9', () => {
    const org = new mongoose.Types.ObjectId();
    const employee = new mongoose.Types.ObjectId();

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });
    beforeEach(async () => { await clearDb(); });

    test('SiteAllowance saves and derives totalAmount', async () => {
        const SiteAllowance = require('../src/models/SiteAllowance');
        const doc = await SiteAllowance.create({ organizationId: org, employee, site: 'Site A', days: 5, rate: 200 });
        assert.equal(doc.totalAmount, 1000);
    });

    test('SupportTicket saves and generates a ticketId', async () => {
        const SupportTicket = require('../src/models/SupportTicket');
        const doc = await SupportTicket.create({ organizationId: org, subject: 's', description: 'd' });
        assert.match(doc.ticketId, /^TKT-\d{5}$/);
    });

    test('BankDetail saves', async () => {
        const BankDetail = require('../src/models/BankDetail');
        const doc = await BankDetail.create({
            organizationId: org, employeeId: employee, encryptedAccountNumber: 'enc',
            lastFourDigits: '1234', bankName: 'HDFC', ifscCode: 'HDFC0001234', accountHolderName: 'X',
        });
        assert.ok(doc._id);
    });

    test('SalaryTemplate saves when the percentages total 100', async () => {
        const SalaryTemplate = require('../src/models/SalaryTemplate');
        const doc = await SalaryTemplate.create({
            organizationId: org, name: 'T',
            basicPercent: 50, hraPercent: 20, daPercent: 20, specialAllowancePercent: 10,
        });
        assert.ok(doc._id);
    });

    test('SalaryTemplate still rejects percentages that do not total 100', async () => {
        const SalaryTemplate = require('../src/models/SalaryTemplate');
        await assert.rejects(
            SalaryTemplate.create({
                organizationId: org, name: 'Bad',
                basicPercent: 50, hraPercent: 20, daPercent: 20, specialAllowancePercent: 5,
            }),
            /exactly 100/,
            'the validation rule must survive the hook-style migration'
        );
    });
});
