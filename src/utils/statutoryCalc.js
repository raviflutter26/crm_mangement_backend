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

    // Employee Contribution: 12% of pfWage
    const employeeEPF = Math.round(pfWage * (employeeContributionRate / 100));

    // Employer Contribution base (capped or actual)
    let cappedWage = pfWage;
    if (employerContributionMode === 'Restrict to ₹15,000 of PF Wage') {
        cappedWage = Math.min(pfWage, employerPFWageLimit);
    }

    // EPS: 8.33% of capped wage (max ₹1,250)
    const employerEPS = Math.round(cappedWage * 0.0833);
    
    // Total Employer PF at 12%
    const totalEmployerPFAt12 = Math.round(cappedWage * 0.12);
    
    // Employer EPF: total - EPS
    const employerEPF = totalEmployerPFAt12 - employerEPS;

    // EDLI: 0.5% of capped wage
    const employerEDLI = Math.round(cappedWage * 0.005);

    // Admin Charges: 0.5% of capped wage
    const employerAdminCharges = Math.round(cappedWage * 0.005);

    return {
        employeeContribution: { epf: employeeEPF },
        employerContribution: {
            eps: employerEPS,
            epf: employerEPF,
            edli: employerEDLI,
            adminCharges: employerAdminCharges
        },
        total: employeeEPF + employerEPS + employerEPF + employerEDLI + employerAdminCharges
    };
};

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

    const employeeESI = Math.round(grossPay * (employeeContribution / 100));
    const employerESI = Math.round(grossPay * (employerContribution / 100));

    return {
        employeeESI,
        employerESI,
        notApplicable: false
    };
};

const calculatePT = (monthlySalary, state, config) => {
    if (!config.ptEnabled) return 0;

    // Default Tamil Nadu slabs if not provided
    const slabs = config.ptSlabs && config.ptSlabs.length > 0 ? config.ptSlabs : [
        { minSalary: 0, maxSalary: 21000, taxAmount: 0 },
        { minSalary: 21001, maxSalary: null, taxAmount: 208.33 }
    ];

    const slab = slabs.find(s => 
        monthlySalary >= s.minSalary && (s.maxSalary === null || monthlySalary <= s.maxSalary)
    );

    return slab ? Math.round(slab.taxAmount) : 0;
};

const calculateLWF = (config, month) => {
    if (!config.lwfEnabled) return { employeeLWF: 0, employerLWF: 0 };

    const { deductionCycle = 'Yearly', employeeContribution = 20, employerContribution = 40 } = config;

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

const calculateStatutoryBonus = (basicPay, config) => {
    const { statutoryBonusEnabled = true, bonusPercentage = 8.33, eligibilityLimit = 21000 } = config;

    if (!statutoryBonusEnabled || basicPay > eligibilityLimit) return 0;

    return Math.round(basicPay * (bonusPercentage / 100));
};

module.exports = {
    calculateEPF,
    calculateESI,
    calculatePT,
    calculateLWF,
    calculateStatutoryBonus
};
