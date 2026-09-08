const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { calculateSalaryBreakdown, calculateTDS } = require('../src/utils/taxCalculator');

// A complete StatutoryConfig-shaped object, since calculateSalaryBreakdown
// reads nested sections directly.
const config = {
    epf: {
        epfEnabled: true,
        employeeContributionRate: 12,
        employerPFWageLimit: 15000,
        employerContributionMode: 'Restrict to ₹15,000 of PF Wage',
    },
    esi: {
        esiEnabled: true,
        esiSalaryLimit: 21000,
        employeeContribution: 0.75,
        employerContribution: 3.25,
    },
    professionalTax: { ptEnabled: true, ptState: 'Tamil Nadu' },
    labourWelfareFund: {
        lwfEnabled: true,
        deductionCycle: 'Yearly',
        employeeContribution: 20,
        employerContribution: 40,
    },
    statutoryBonus: {
        statutoryBonusEnabled: true,
        bonusPercentage: 8.33,
        eligibilityLimit: 21000,
    },
};

const employee = (salary, extra = {}) => ({
    salary,
    statutory: {},
    ...extra,
});

describe('calculateSalaryBreakdown — pro-rating', () => {
    const salary = { basic: 20000, hra: 8000, da: 0, specialAllowance: 12000 };

    test('a full month pays the full gross', () => {
        const r = calculateSalaryBreakdown(employee(salary), config, 26, 26, 6);
        assert.equal(r.earnings.basic, 20000);
        assert.equal(r.earnings.hra, 8000);
        assert.equal(r.grossEarnings, 40000);
        assert.equal(r.presentDays, 26);
    });

    test('half a month halves every earning component', () => {
        const r = calculateSalaryBreakdown(employee(salary), config, 26, 13, 6);
        assert.equal(r.earnings.basic, 10000);
        assert.equal(r.earnings.hra, 4000);
        assert.equal(r.earnings.specialAllowance, 6000);
        assert.equal(r.grossEarnings, 20000);
    });

    test('zero present days produces zero gross, not a negative net', () => {
        const r = calculateSalaryBreakdown(employee(salary), config, 26, 0, 6);
        assert.equal(r.grossEarnings, 0);
        assert.equal(r.deductions.pf, 0);
        assert.ok(r.netPay <= 0, 'net pay should not be positive with no attendance');
    });

    test('net pay always equals gross minus the itemised deductions', () => {
        const r = calculateSalaryBreakdown(employee(salary), config, 26, 22, 6);
        const sum = r.deductions.pf + r.deductions.esi + r.deductions.professionalTax
            + r.deductions.lwf + r.deductions.tds;
        assert.equal(r.totalDeductions, sum);
        assert.equal(r.netPay, r.grossEarnings - r.totalDeductions);
    });

    test('guards against a zero working-day divisor', () => {
        const r = calculateSalaryBreakdown(employee(salary), config, 0, 0, 6);
        assert.ok(Number.isFinite(r.grossEarnings), 'gross must not be NaN/Infinity');
    });
});

describe('calculateSalaryBreakdown — LWF is tied to the payroll period', () => {
    const salary = { basic: 20000, hra: 8000, da: 0, specialAllowance: 12000 };

    // Regression guard: this previously used new Date().getMonth(), so the
    // result depended on when the run was executed rather than which month it
    // covered — re-running an old payroll produced different numbers.
    test('a yearly cycle deducts LWF for month 12 regardless of today', () => {
        const december = calculateSalaryBreakdown(employee(salary), config, 26, 26, 12);
        assert.equal(december.deductions.lwf, 20);
    });

    test('a yearly cycle deducts nothing for month 7', () => {
        const july = calculateSalaryBreakdown(employee(salary), config, 26, 26, 7);
        assert.equal(july.deductions.lwf, 0);
    });

    test('the same period always yields the same result', () => {
        const a = calculateSalaryBreakdown(employee(salary), config, 26, 26, 3);
        const b = calculateSalaryBreakdown(employee(salary), config, 26, 26, 3);
        assert.deepEqual(a.deductions, b.deductions);
    });
});

describe('calculateSalaryBreakdown — ESI eligibility follows pro-rated gross', () => {
    test('a high earner on partial attendance can fall under the ESI limit', () => {
        const salary = { basic: 20000, hra: 10000, da: 0, specialAllowance: 10000 };
        const full = calculateSalaryBreakdown(employee(salary), config, 26, 26, 6);
        const half = calculateSalaryBreakdown(employee(salary), config, 26, 13, 6);

        assert.equal(full.grossEarnings, 40000);
        assert.equal(full.deductions.esi, 0, 'above the 21,000 limit');

        assert.equal(half.grossEarnings, 20000);
        assert.ok(half.deductions.esi > 0, 'pro-rated gross is now within the limit');
    });
});

describe('calculateSalaryBreakdown — higher-pension opt-in resolution', () => {
    // Basic of 30,000 puts the employee above the EPS ceiling, and actual-wage
    // mode is required for the ceiling to matter at all.
    const salary = { basic: 30000, hra: 0, da: 0, specialAllowance: 0 };
    const actualWageConfig = {
        ...config,
        epf: { ...config.epf, employerContributionMode: 'Actual PF Wage' },
    };

    test('defaults to the capped EPS when neither level opts in', () => {
        const r = calculateSalaryBreakdown(employee(salary), actualWageConfig, 26, 26, 6);
        assert.equal(r.employerContributions.eps, 1250);
    });

    test('an organization-wide opt-in is not overwritten by the employee default', () => {
        // Mongoose materialises User.statutory.pf.higherPensionOptedIn as false,
        // so a plain spread would clobber the org setting. Regression guard.
        const orgOptedIn = {
            ...actualWageConfig,
            epf: { ...actualWageConfig.epf, higherPensionOptedIn: true },
        };
        const emp = employee(salary, { statutory: { pf: { higherPensionOptedIn: false } } });

        const r = calculateSalaryBreakdown(emp, orgOptedIn, 26, 26, 6);
        assert.equal(r.employerContributions.eps, 2499);
    });

    test('an individual opt-in works without an organization-wide setting', () => {
        const emp = employee(salary, { statutory: { pf: { higherPensionOptedIn: true } } });
        const r = calculateSalaryBreakdown(emp, actualWageConfig, 26, 26, 6);
        assert.equal(r.employerContributions.eps, 2499);
    });

    test('the employer total stays at 12% either way', () => {
        const capped = calculateSalaryBreakdown(employee(salary), actualWageConfig, 26, 26, 6);
        const opted = calculateSalaryBreakdown(
            employee(salary, { statutory: { pf: { higherPensionOptedIn: true } } }),
            actualWageConfig, 26, 26, 6
        );

        // Only the EPS/EPF split moves; the employer's overall outlay does not.
        assert.equal(capped.employerContributions.eps + capped.employerContributions.epf, 3600);
        assert.equal(opted.employerContributions.eps + opted.employerContributions.epf, 3600);
    });
});

describe('calculateTDS', () => {
    test('no tax at or below the 12L rebate threshold', () => {
        assert.equal(calculateTDS(0), 0);
        assert.equal(calculateTDS(1200000), 0);
    });

    test('tax applies above the rebate threshold', () => {
        assert.ok(calculateTDS(1200001) > 0);
    });

    test('is monotonic — more income never means less tax', () => {
        let prev = -1;
        for (const income of [0, 400000, 800000, 1200000, 1200001, 1600000, 2000000, 2400000, 5000000]) {
            const tax = calculateTDS(income);
            assert.ok(tax >= prev, `tax fell at ${income}: ${tax} < ${prev}`);
            prev = tax;
        }
    });

    test('returns a monthly figure, including 4% cess', () => {
        // 16L: 5% on 4L + 10% on 4L + 15% on 4L = 20,000+40,000+60,000 = 120,000
        // plus 4% cess = 124,800, over 12 months = 10,400
        assert.equal(calculateTDS(1600000), 10400);
    });

    test('the old regime is not yet implemented — the parameter is ignored', () => {
        // Documented gap: `regime` and `tdsSettings` are accepted but unused, so
        // an employee with taxRegime 'old' is taxed on new-regime slabs. Pinned
        // here so implementing the old regime has to update this test knowingly.
        assert.equal(calculateTDS(1600000, 'old'), calculateTDS(1600000, 'new'));
    });
});
