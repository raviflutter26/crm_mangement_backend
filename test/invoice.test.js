const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const Invoice = require('../src/models/Invoice');
const { computeTotals, deriveStatus, sumPayments } = Invoice;

// Fixed reference points so a test can never depend on the day it runs.
const PAST = new Date('2026-01-01');
const FUTURE = new Date('2027-01-01');
const NOW = new Date('2026-06-01');

describe('computeTotals', () => {
    test('adds GST at the given rate', () => {
        assert.deepEqual(computeTotals(100000, 18), { taxAmount: 18000, total: 118000 });
    });

    test('a zero rate leaves the subtotal untouched', () => {
        assert.deepEqual(computeTotals(50000, 0), { taxAmount: 0, total: 50000 });
    });

    test('rounds tax to whole rupees, matching how money is stored', () => {
        // 10.5% of 1005 is 105.525 — it must not persist as a fraction.
        const { taxAmount } = computeTotals(1005, 10.5);
        assert.equal(taxAmount, 106);
        assert.equal(Number.isInteger(taxAmount), true);
    });

    test('treats missing or non-numeric input as zero rather than NaN', () => {
        assert.deepEqual(computeTotals(undefined, undefined), { taxAmount: 0, total: 0 });
        assert.deepEqual(computeTotals('abc', 18), { taxAmount: 0, total: 0 });
    });
});

describe('sumPayments', () => {
    test('totals every recorded payment', () => {
        assert.equal(sumPayments([{ amount: 500 }, { amount: 1500 }]), 2000);
    });

    test('an absent or empty list sums to zero', () => {
        assert.equal(sumPayments(undefined), 0);
        assert.equal(sumPayments([]), 0);
    });

    test('ignores malformed entries instead of returning NaN', () => {
        assert.equal(sumPayments([{ amount: 100 }, {}, null, { amount: 'x' }]), 100);
    });
});

describe('deriveStatus', () => {
    test('Draft is never advanced automatically — it is not yet revenue', () => {
        const status = deriveStatus({ status: 'Draft', total: 1000, payments: [{ amount: 1000 }], now: NOW });
        assert.equal(status, 'Draft');
    });

    test('Cancelled is never advanced automatically, even if money arrived', () => {
        const status = deriveStatus({ status: 'Cancelled', total: 1000, payments: [{ amount: 1000 }], now: NOW });
        assert.equal(status, 'Cancelled');
    });

    test('unpaid and not yet due reads as Sent', () => {
        assert.equal(deriveStatus({ status: 'Sent', total: 1000, payments: [], dueDate: FUTURE, now: NOW }), 'Sent');
    });

    test('unpaid past its due date reads as Overdue', () => {
        assert.equal(deriveStatus({ status: 'Sent', total: 1000, payments: [], dueDate: PAST, now: NOW }), 'Overdue');
    });

    test('an invoice with no due date is never Overdue', () => {
        assert.equal(deriveStatus({ status: 'Sent', total: 1000, payments: [], now: NOW }), 'Sent');
    });

    test('part payment reads as Partially Paid', () => {
        assert.equal(deriveStatus({ status: 'Sent', total: 1000, payments: [{ amount: 400 }], now: NOW }), 'Partially Paid');
    });

    test('payment in full reads as Paid', () => {
        assert.equal(deriveStatus({ status: 'Sent', total: 1000, payments: [{ amount: 1000 }], now: NOW }), 'Paid');
    });

    test('an overdue invoice becomes Paid once settled, not stuck on Overdue', () => {
        const status = deriveStatus({ status: 'Overdue', total: 1000, payments: [{ amount: 1000 }], dueDate: PAST, now: NOW });
        assert.equal(status, 'Paid');
    });

    test('several part payments that together settle it read as Paid', () => {
        const status = deriveStatus({ status: 'Sent', total: 1000, payments: [{ amount: 600 }, { amount: 400 }], now: NOW });
        assert.equal(status, 'Paid');
    });
});

describe('Invoice schema', () => {
    test('rejects an invoice with no organization, so nothing escapes tenant scoping', () => {
        const err = new Invoice({ invoiceNumber: 'INV-1', client: 'Acme', subtotal: 100 }).validateSync();
        assert.ok(err, 'expected validation to fail');
        assert.ok(err.errors.organizationId, 'organizationId should be required');
    });

    test('rejects a status outside the allowed set', () => {
        const err = new Invoice({
            invoiceNumber: 'INV-1',
            client: 'Acme',
            subtotal: 100,
            organizationId: '650000000000000000000001',
            status: 'Refunded',
        }).validateSync();
        assert.ok(err.errors.status, 'status should be constrained to the enum');
    });

    test('accepts a well-formed invoice', () => {
        const err = new Invoice({
            invoiceNumber: 'INV-1',
            client: 'Acme',
            subtotal: 100,
            organizationId: '650000000000000000000001',
        }).validateSync();
        assert.equal(err, undefined);
    });
});
