const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Must come before src/app is required — it sets NODE_ENV/JWT_SECRET/MONGODB_URI.
const { startDb, stopDb, clearDb, authFor } = require('../test-utils/testEnv');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const invoicePayload = (over = {}) => ({
    invoiceNumber: 'INV-001',
    client: 'Acme Pvt Ltd',
    subtotal: 100000,
    taxRate: 18,
    status: 'Sent',
    ...over,
});

describe('Revenue API', () => {
    let adminA, adminB, employeeA;

    before(async () => { await startDb(); });
    after(async () => { await stopDb(); });

    beforeEach(async () => {
        await clearDb();
        adminA = await authFor({ role: 'admin', organizationId: ORG_A });
        adminB = await authFor({ role: 'admin', organizationId: ORG_B });
        employeeA = await authFor({ role: 'employee', organizationId: ORG_A });
    });

    describe('access control', () => {
        test('rejects an unauthenticated request', async () => {
            const res = await request(app).get('/api/revenue/summary');
            assert.equal(res.status, 401);
            assert.equal(res.body.success, false);
        });

        test('rejects a token signed with the wrong secret', async () => {
            const res = await request(app)
                .get('/api/revenue/summary')
                .set('Authorization', 'Bearer not-a-real-token');
            assert.equal(res.status, 401);
        });

        test('an employee may not read organization revenue', async () => {
            const res = await request(app)
                .get('/api/revenue/summary')
                .set('Authorization', employeeA.header);
            assert.equal(res.status, 403);
        });

        test('an employee may not raise an invoice', async () => {
            const res = await request(app)
                .post('/api/revenue/invoices')
                .set('Authorization', employeeA.header)
                .send(invoicePayload());
            assert.equal(res.status, 403);
        });

        test('an admin may read revenue', async () => {
            const res = await request(app)
                .get('/api/revenue/summary')
                .set('Authorization', adminA.header);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
        });
    });

    describe('tenant isolation', () => {
        test("one organization cannot see another's invoices", async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const mine = await request(app).get('/api/revenue/invoices').set('Authorization', adminA.header);
            assert.equal(mine.body.data.length, 1);

            const theirs = await request(app).get('/api/revenue/invoices').set('Authorization', adminB.header);
            assert.equal(theirs.body.data.length, 0, "org B must not see org A's invoice");
        });

        test("another organization's revenue is not counted in the summary", async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const res = await request(app).get('/api/revenue/summary').set('Authorization', adminB.header);
            assert.equal(res.body.data.totalInvoiced, 0);
        });

        test('a client-supplied organizationId cannot move an invoice to another tenant', async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header)
                .send(invoicePayload({ organizationId: ORG_B.toString() }))
                .expect(201);

            // The forged id must be ignored: it belongs to A, who created it.
            const theirs = await request(app).get('/api/revenue/invoices').set('Authorization', adminB.header);
            assert.equal(theirs.body.data.length, 0);

            const mine = await request(app).get('/api/revenue/invoices').set('Authorization', adminA.header);
            assert.equal(mine.body.data.length, 1);
        });

        test("fetching another tenant's invoice by id 404s rather than leaking it", async () => {
            const created = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const res = await request(app)
                .get(`/api/revenue/invoices/${created.body.data._id}`)
                .set('Authorization', adminB.header);
            assert.equal(res.status, 404);
        });
    });

    describe('invoice creation', () => {
        test('computes tax and total server-side', async () => {
            const res = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            assert.equal(res.body.data.taxAmount, 18000);
            assert.equal(res.body.data.total, 118000);
        });

        test('ignores a client-supplied total, so money cannot be forged', async () => {
            const res = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header)
                .send(invoicePayload({ total: 999999, taxAmount: 999999 }))
                .expect(201);

            assert.equal(res.body.data.total, 118000);
        });

        test('rejects a duplicate invoice number within the same organization', async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const res = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload());
            assert.equal(res.status, 409);
        });

        test('allows the same invoice number in a different organization', async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const res = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminB.header).send(invoicePayload());
            assert.equal(res.status, 201);
        });
    });

    describe('revenue recognition', () => {
        test('a Draft invoice is not counted as revenue', async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header)
                .send(invoicePayload({ status: 'Draft' }))
                .expect(201);

            const res = await request(app).get('/api/revenue/summary').set('Authorization', adminA.header);
            assert.equal(res.body.data.totalInvoiced, 0, 'a draft is not revenue');
            assert.equal(res.body.data.draftCount, 1);
        });

        test('an issued invoice counts as invoiced but not yet collected', async () => {
            await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);

            const res = await request(app).get('/api/revenue/summary').set('Authorization', adminA.header);
            assert.equal(res.body.data.totalInvoiced, 118000);
            assert.equal(res.body.data.totalCollected, 0);
            assert.equal(res.body.data.totalOutstanding, 118000);
        });
    });

    describe('recording payments', () => {
        let invoiceId;

        beforeEach(async () => {
            const created = await request(app).post('/api/revenue/invoices')
                .set('Authorization', adminA.header).send(invoicePayload()).expect(201);
            invoiceId = created.body.data._id;
        });

        test('a part payment marks the invoice Partially Paid', async () => {
            const res = await request(app)
                .post(`/api/revenue/invoices/${invoiceId}/payments`)
                .set('Authorization', adminA.header)
                .send({ amount: 18000 });

            assert.equal(res.status, 201);
            assert.equal(res.body.data.status, 'Partially Paid');
        });

        test('paying the full amount marks it Paid and updates collected revenue', async () => {
            await request(app).post(`/api/revenue/invoices/${invoiceId}/payments`)
                .set('Authorization', adminA.header).send({ amount: 118000 }).expect(201);

            const res = await request(app).get('/api/revenue/summary').set('Authorization', adminA.header);
            assert.equal(res.body.data.totalCollected, 118000);
            assert.equal(res.body.data.totalOutstanding, 0);
        });

        test('refuses a payment larger than the outstanding balance', async () => {
            const res = await request(app)
                .post(`/api/revenue/invoices/${invoiceId}/payments`)
                .set('Authorization', adminA.header)
                .send({ amount: 200000 });

            assert.equal(res.status, 400);
            assert.match(res.body.message, /exceeds/i);
        });

        test('refuses a zero or negative payment', async () => {
            for (const amount of [0, -500]) {
                const res = await request(app)
                    .post(`/api/revenue/invoices/${invoiceId}/payments`)
                    .set('Authorization', adminA.header)
                    .send({ amount });
                assert.equal(res.status, 400, `amount ${amount} should be rejected`);
            }
        });

        test("cannot record a payment against another tenant's invoice", async () => {
            const res = await request(app)
                .post(`/api/revenue/invoices/${invoiceId}/payments`)
                .set('Authorization', adminB.header)
                .send({ amount: 1000 });
            assert.equal(res.status, 404);
        });
    });
});
