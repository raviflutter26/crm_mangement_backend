const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    calculateEPF,
    calculateESI,
    calculatePT,
    calculateLWF,
    calculateStatutoryBonus,
} = require('../src/utils/statutoryCalc');

const EPF_RESTRICTED = {
    employeeContributionRate: 12,
    employerPFWageLimit: 15000,
    employerContributionMode: 'Restrict to ₹15,000 of PF Wage',
};

describe('EPF', () => {
    test('splits the employer 12% into EPS 8.33% and EPF 3.67% at the ceiling', () => {
        const r = calculateEPF(15000, EPF_RESTRICTED);

        assert.equal(r.employeeContribution.epf, 1800);      // 12% of 15,000
        assert.equal(r.employerContribution.eps, 1250);      // statutory EPS maximum
        assert.equal(r.employerContribution.epf, 550);       // 1800 - 1250
        assert.equal(r.employerContribution.edli, 75);       // 0.5%
        assert.equal(r.employerContribution.adminCharges, 75);

        // Employer's EPS + EPF must always reconstitute the 12%
        assert.equal(r.employerContribution.eps + r.employerContribution.epf, 1800);
    });

    test('below the ceiling, everything scales off actual wage', () => {
        const r = calculateEPF(10000, EPF_RESTRICTED);

        assert.equal(r.employeeContribution.epf, 1200);
        assert.equal(r.employerContribution.eps, 833);
        assert.equal(r.employerContribution.epf, 1200 - 833);
        assert.equal(r.employerContribution.eps + r.employerContribution.epf, 1200);
    });

    test('restricted mode caps the employer base but not the employee share', () => {
        const r = calculateEPF(30000, EPF_RESTRICTED);

        // Employee contributes on actual wage
        assert.equal(r.employeeContribution.epf, 3600);
        // Employer is capped at the 15,000 base
        assert.equal(r.employerContribution.eps, 1250);
        assert.equal(r.employerContribution.epf, 550);
        assert.equal(r.employerContribution.edli, 75);
    });

    test('a zero wage produces no contributions rather than NaN', () => {
        const r = calculateEPF(0, EPF_RESTRICTED);
        assert.equal(r.total, 0);
        assert.equal(r.employeeContribution.epf, 0);
    });

    test('actual-wage mode raises the employer base but EPS stays at the ceiling', () => {
        const r = calculateEPF(30000, {
            ...EPF_RESTRICTED,
            employerContributionMode: 'Actual PF Wage',
        });

        // Employer's total 12% is computed on the full 30,000
        assert.equal(r.employerContribution.eps + r.employerContribution.epf, 3600);

        // EPS is capped at 8.33% of the ₹15,000 pensionable wage ceiling...
        assert.equal(r.employerContribution.eps, 1250);
        // ...and the remainder is redirected to EPF rather than lost
        assert.equal(r.employerContribution.epf, 2350);
    });

    test('an employee who opted for higher pension is not bound by the ceiling', () => {
        const r = calculateEPF(30000, {
            ...EPF_RESTRICTED,
            employerContributionMode: 'Actual PF Wage',
            higherPensionOptedIn: true,
        });

        assert.equal(r.employerContribution.eps, 2499);   // 8.33% of actual wage
        assert.equal(r.employerContribution.eps + r.employerContribution.epf, 3600);
    });

    test('the ceiling does not change restricted mode, the common case', () => {
        // Restricted mode already capped the base at 15,000, so capping the
        // pensionable wage is a no-op there. Guards against the fix altering
        // payslips for the majority of employees.
        const r = calculateEPF(30000, EPF_RESTRICTED);
        assert.equal(r.employerContribution.eps, 1250);
        assert.equal(r.employerContribution.epf, 550);
    });
});

describe('ESI', () => {
    test('applies at the wage limit', () => {
        const r = calculateESI(21000, {});
        assert.equal(r.notApplicable, false);
        assert.equal(r.employeeESI, 158);   // 0.75%
        assert.equal(r.employerESI, 683);   // 3.25%
    });

    test('drops out one rupee above the limit', () => {
        const r = calculateESI(21001, {});
        assert.equal(r.notApplicable, true);
        assert.equal(r.employeeESI, 0);
        assert.equal(r.employerESI, 0);
    });

    test('returns zero when disabled', () => {
        const r = calculateESI(10000, { esiEnabled: false });
        assert.equal(r.notApplicable, true);
        assert.equal(r.employeeESI, 0);
    });
});

describe('Professional Tax', () => {
    const enabled = { ptEnabled: true };

    test('uses the Tamil Nadu default slabs when none are configured', () => {
        assert.equal(calculatePT(15000, 'Tamil Nadu', enabled), 0);
        assert.equal(calculatePT(21000, 'Tamil Nadu', enabled), 0);
        assert.equal(calculatePT(21001, 'Tamil Nadu', enabled), 208);
    });

    test('honours configured slabs, including an open-ended top slab', () => {
        const config = {
            ptEnabled: true,
            ptSlabs: [
                { minSalary: 0, maxSalary: 7500, taxAmount: 0 },
                { minSalary: 7501, maxSalary: 10000, taxAmount: 175 },
                { minSalary: 10001, maxSalary: null, taxAmount: 200 },
            ],
        };
        assert.equal(calculatePT(7500, 'Maharashtra', config), 0);
        assert.equal(calculatePT(7501, 'Maharashtra', config), 175);
        assert.equal(calculatePT(10000, 'Maharashtra', config), 175);
        assert.equal(calculatePT(10001, 'Maharashtra', config), 200);
        assert.equal(calculatePT(500000, 'Maharashtra', config), 200);
    });

    test('returns zero when disabled', () => {
        assert.equal(calculatePT(50000, 'Tamil Nadu', { ptEnabled: false }), 0);
    });
});

describe('Labour Welfare Fund', () => {
    const yearly = { lwfEnabled: true, deductionCycle: 'Yearly', employeeContribution: 20, employerContribution: 40 };

    test('yearly cycle deducts only in December', () => {
        assert.deepEqual(calculateLWF(yearly, 12), { employeeLWF: 20, employerLWF: 40 });
        assert.deepEqual(calculateLWF(yearly, 11), { employeeLWF: 0, employerLWF: 0 });
        assert.deepEqual(calculateLWF(yearly, 1), { employeeLWF: 0, employerLWF: 0 });
    });

    test('half-yearly cycle deducts in June and December', () => {
        const halfYearly = { ...yearly, deductionCycle: 'Half Yearly' };
        assert.equal(calculateLWF(halfYearly, 6).employeeLWF, 20);
        assert.equal(calculateLWF(halfYearly, 12).employeeLWF, 20);
        assert.equal(calculateLWF(halfYearly, 7).employeeLWF, 0);
    });

    test('monthly cycle deducts every month', () => {
        const monthly = { ...yearly, deductionCycle: 'Monthly' };
        for (let m = 1; m <= 12; m++) {
            assert.equal(calculateLWF(monthly, m).employeeLWF, 20, `month ${m}`);
        }
    });

    test('returns zero when disabled', () => {
        assert.deepEqual(calculateLWF({ lwfEnabled: false }, 12), { employeeLWF: 0, employerLWF: 0 });
    });
});

describe('Statutory bonus', () => {
    test('pays 8.33% up to the eligibility limit', () => {
        const config = { statutoryBonusEnabled: true, bonusPercentage: 8.33, eligibilityLimit: 21000 };
        assert.equal(calculateStatutoryBonus(21000, config), 1749);
        assert.equal(calculateStatutoryBonus(10000, config), 833);
    });

    test('is not payable above the eligibility limit', () => {
        const config = { statutoryBonusEnabled: true, bonusPercentage: 8.33, eligibilityLimit: 21000 };
        assert.equal(calculateStatutoryBonus(21001, config), 0);
    });

    test('returns zero when disabled', () => {
        assert.equal(calculateStatutoryBonus(10000, { statutoryBonusEnabled: false }), 0);
    });
});
