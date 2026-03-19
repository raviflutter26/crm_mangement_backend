/**
 * Statutory Calculation Utility for Indian Payroll
 * Matches Zoho Payroll Logic
 */

/**
 * Calculate EPF (Employee Provident Fund)
 * @param {number} pfWage - The wage base for PF calculation (usually Basic)
 * @param {object} config - Global StatutoryConfig.epf settings
 * @returns {object} Breakdown of EPF contributions
 */
const calculateEPF = (pfWage, config) => {
    const {
        employeeContributionRate = 12,
        employerPFWageLimit = 15000,
        employerContributionMode = 'Restrict to ₹15,000 of PF Wage'
    } = config;

    // Employee Contribution: 12% of actual PF wage (no cap for employee typically)
    const employeeEPF = Math.round(pfWage * (employeeContributionRate / 100));

    // Employer Contribution logic
    let effectiveEmployerPFWage = pfWage;
    if (employerContributionMode === 'Restrict to ₹15,000 of PF Wage') {
        effectiveEmployerPFWage = Math.min(pfWage, employerPFWageLimit);
    }

    // EPS (Employee Pension Scheme): 8.33% of capped wage (max ₹1,250)
    const employerEPS = Math.round(effectiveEmployerPFWage * 0.0833);
    
    // Employer EPF: 12% of capped wage - EPS
    // Note: The total employer contribution is 12%, split between EPS and EPF
    const totalEmployerPF = Math.round(effectiveEmployerPFWage * 0.12);
    const employerEPF = totalEmployerPF - employerEPS;

    // EDLI (Employees' Deposit Linked Insurance): 0.5% of capped wage
    const employerEDLI = Math.round(effectiveEmployerPFWage * 0.005);

    // Admin Charges: 0.5% of capped wage (minimum ₹75 often applies but using flat 0.5% here)
    const employerAdminCharges = Math.max(75, Math.round(effectiveEmployerPFWage * 0.005));

    return {
        employeeContribution: {
            epf: employeeEPF
        },
        employerContribution: {
            eps: employerEPS,
            epf: employerEPF,
            edli: employerEDLI,
            adminCharges: employerAdminCharges
        },
        totalEmployee: employeeEPF,
        totalEmployer: employerEPS + employerEPF + employerEDLI + employerAdminCharges
    };
};

/**
 * Calculate ESI (Employees' State Insurance)
 * @param {number} grossPay - Total gross salary for the month
 * @param {object} config - Global StatutoryConfig.esi settings
 * @returns {object} Employee and Employer contributions
 */
const calculateESI = (grossPay, config) => {
    const {
        esiEnabled = true,
        esiSalaryLimit = 21000,
        employeeContribution = 0.75,
        employerContribution = 3.25
    } = config;

    if (!esiEnabled || grossPay > esiSalaryLimit) {
        return {
            employeeESI: 0,
            employerESI: 0,
            notApplicable: true
        };
    }

    const employeeESI = Math.ceil(grossPay * (employeeContribution / 100)); // ESI is usually rounded to next rupee
    const employerESI = Math.ceil(grossPay * (employerContribution / 100));

    return {
        employeeESI,
        employerESI,
        notApplicable: false
    };
};

/**
 * Calculate Professional Tax (PT)
 * @param {number} grossSalary - Monthly gross salary
 * @param {string} state - The state (e.g., "Tamil Nadu")
 * @param {object} config - Global StatutoryConfig.professionalTax settings
 * @returns {number} Monthly PT amount
 */
const calculatePT = (grossSalary, state, config) => {
    if (!config.ptEnabled) return 0;

    // Default slabs for Tamil Nadu if not provided in config
    const slabs = config.ptSlabs && config.ptSlabs.length > 0 ? config.ptSlabs : [
        { minSalary: 0, maxSalary: 21000, taxAmount: 0 },
        { minSalary: 21001, maxSalary: null, taxAmount: 208.33 } // ₹2500 / 12 (roughly)
    ];

    const slab = slabs.find(s => 
        grossSalary >= s.minSalary && (s.maxSalary === null || grossSalary <= s.maxSalary)
    );

    return slab ? Math.round(slab.taxAmount) : 0;
};

/**
 * Calculate Labour Welfare Fund (LWF)
 * @param {object} config - Global StatutoryConfig.labourWelfareFund settings
 * @param {number} month - Current month (1-12)
 * @returns {object} Employee and Employer LWF amounts
 */
const calculateLWF = (config, month) => {
    if (!config.lwfEnabled) return { employeeLWF: 0, employerLWF: 0 };

    const { deductionCycle = 'Yearly', employeeContribution = 20, employerContribution = 40 } = config;

    // Check if deduction is due this month
    let isDue = false;
    if (deductionCycle === 'Yearly' && month === 12) isDue = true;
    if (deductionCycle === 'Half Yearly' && (month === 6 || month === 12)) isDue = true;
    if (deductionCycle === 'Monthly') isDue = true;

    if (!isDue) return { employeeLWF: 0, employerLWF: 0 };

    return {
        employeeLWF: employeeContribution,
        employerLWF: employerContribution
    };
};

/**
 * Calculate Statutory Bonus
 * @param {number} basicPay - Monthly basic pay
 * @param {object} config - Global StatutoryConfig.statutoryBonus settings
 * @returns {number} Monthly bonus accrual
 */
const calculateStatutoryBonus = (basicPay, config) => {
    if (!config.statutoryBonusEnabled) return 0;

    const { eligibilityLimit = 21000, bonusPercentage = 8.33 } = config;

    if (basicPay > eligibilityLimit) return 0;

    return Math.round(basicPay * (bonusPercentage / 100));
};

module.exports = {
    calculateEPF,
    calculateESI,
    calculatePT,
    calculateLWF,
    calculateStatutoryBonus
};
