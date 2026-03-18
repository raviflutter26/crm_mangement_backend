/**
 * Indian Statutory Tax Calculator
 * Calculates PF, ESI, PT, and TDS based on compliance settings
 */

/**
 * Calculate Employee PF contribution
 * @param {number} basicSalary - Monthly basic salary
 * @param {object} pfSettings - PF compliance settings
 * @returns {object} { employeePF, employerPF, adminCharges, edliCharges }
 */
const calculatePF = (basicSalary, pfSettings = {}) => {
    if (!pfSettings.enabled) return { employeePF: 0, employerPF: 0, adminCharges: 0, edliCharges: 0 };

    // If wageLimit is explicitly null or 0, use full basic salary (no ceiling)
    const wageLimit = pfSettings.wageLimit === 0 || pfSettings.wageLimit === null ? Infinity : (pfSettings.wageLimit || 15000);
    const pfWage = Math.min(basicSalary, wageLimit);
    const empRate = (pfSettings.employeeContribution || 12) / 100;
    const erRate = (pfSettings.employerContribution || 12) / 100;
    const adminRate = (pfSettings.adminCharges || 0.5) / 100;
    const edliRate = (pfSettings.edliCharges || 0.5) / 100;

    return {
        employeePF: Math.round(pfWage * empRate),
        employerPF: Math.round(pfWage * erRate),
        adminCharges: Math.round(pfWage * adminRate),
        edliCharges: Math.round(pfWage * edliRate),
    };
};

/**
 * Calculate ESI contributions
 * @param {number} grossSalary - Monthly gross salary
 * @param {object} esiSettings - ESI compliance settings
 * @returns {object} { employeeESI, employerESI }
 */
const calculateESI = (grossSalary, esiSettings = {}) => {
    if (!esiSettings.enabled) return { employeeESI: 0, employerESI: 0 };

    const wageLimit = esiSettings.wageLimit || 21000;
    if (grossSalary >= wageLimit) return { employeeESI: 0, employerESI: 0 };

    const empRate = (esiSettings.employeeContribution || 0.75) / 100;
    const erRate = (esiSettings.employerContribution || 3.25) / 100;

    return {
        employeeESI: Math.round(grossSalary * empRate),
        employerESI: Math.round(grossSalary * erRate),
    };
};

/**
 * Calculate Professional Tax
 * @param {number} grossSalary - Monthly gross salary
 * @param {object} ptSettings - PT compliance settings
 * @returns {number} Monthly PT amount
 */
const calculatePT = (grossSalary, ptSettings = {}) => {
    if (!ptSettings.enabled) return 0;

    const slabs = ptSettings.slabs || [
        { minSalary: 0, maxSalary: 14999, taxAmount: 0 },
        { minSalary: 15000, maxSalary: 25000, taxAmount: 150 },
        { minSalary: 25001, maxSalary: 999999999, taxAmount: 200 },
    ];

    for (const slab of slabs) {
        if (grossSalary >= slab.minSalary && grossSalary <= slab.maxSalary) {
            return slab.taxAmount;
        }
    }
    return 200; // Default max
};

/**
 * Calculate monthly TDS (Income Tax)
 * @param {number} annualIncome - Annual taxable income
 * @param {string} regime - 'old' or 'new'
 * @param {object} tdsSettings - TDS compliance settings
 * @returns {number} Monthly TDS amount
 */
const calculateTDS = (annualIncome, regime = 'new', tdsSettings = {}) => {
    if (!tdsSettings.enabled && tdsSettings.enabled !== undefined) return 0;

    const cessRate = (tdsSettings.cessRate || 4) / 100;

    // New Tax Regime (FY 2025-26)
    const newSlabs = tdsSettings.newRegimeSlabs?.length ? tdsSettings.newRegimeSlabs : [
        { minIncome: 0, maxIncome: 400000, rate: 0 },
        { minIncome: 400001, maxIncome: 800000, rate: 5 },
        { minIncome: 800001, maxIncome: 1200000, rate: 10 },
        { minIncome: 1200001, maxIncome: 1600000, rate: 15 },
        { minIncome: 1600001, maxIncome: 2000000, rate: 20 },
        { minIncome: 2000001, maxIncome: 2400000, rate: 25 },
        { minIncome: 2400001, maxIncome: 999999999, rate: 30 },
    ];

    // Old Tax Regime
    const oldSlabs = tdsSettings.oldRegimeSlabs?.length ? tdsSettings.oldRegimeSlabs : [
        { minIncome: 0, maxIncome: 250000, rate: 0 },
        { minIncome: 250001, maxIncome: 500000, rate: 5 },
        { minIncome: 500001, maxIncome: 1000000, rate: 20 },
        { minIncome: 1000001, maxIncome: 999999999, rate: 30 },
    ];

    const slabs = regime === 'new' ? newSlabs : oldSlabs;
    let totalTax = 0;
    let remaining = annualIncome;

    for (const slab of slabs) {
        if (remaining <= 0) break;
        const slabRange = slab.maxIncome - slab.minIncome + 1;
        const taxableInSlab = Math.min(remaining, slabRange);
        totalTax += taxableInSlab * (slab.rate / 100);
        remaining -= taxableInSlab;
    }

    // Rebate u/s 87A — New regime: no tax if income <= 12L (FY 2025-26)
    if (regime === 'new' && annualIncome <= 1200000) {
        totalTax = 0;
    }
    // Old regime: rebate up to 12,500 if income <= 5L
    if (regime === 'old' && annualIncome <= 500000) {
        totalTax = Math.max(0, totalTax - 12500);
    }

    // Add cess
    totalTax = totalTax + (totalTax * cessRate);

    // Return monthly TDS
    return Math.round(totalTax / 12);
};

/**
 * Calculate complete salary breakdown
 * @param {object} employee - Employee object with salary info
 * @param {object} compliance - ComplianceSettings object
 * @param {number} workingDays - Total working days in month
 * @param {number} presentDays - Employee present days
 * @returns {object} Full salary breakdown
 */
const calculateSalaryBreakdown = (employee, compliance, workingDays = 26, presentDays = 26) => {
    const salary = employee.salary || {};
    const ratio = workingDays > 0 ? presentDays / workingDays : 1;

    // Earnings (pro-rated by attendance)
    const basic = Math.round((salary.basic || 0) * ratio);
    const hra = Math.round((salary.hra || 0) * ratio);
    const da = Math.round((salary.da || 0) * ratio);
    const specialAllowance = Math.round((salary.specialAllowance || 0) * ratio);
    const grossEarnings = basic + hra + da + specialAllowance;

    // PF (Merge global settings with employee-specific overrides)
    const pfResult = calculatePF(basic, {
        ...compliance?.pf,
        employeeContribution: employee.pfEmployeeContributionRate ?? compliance?.pf?.employeeContribution,
        employerContribution: employee.pfEmployerContributionRate ?? compliance?.pf?.employerContribution,
        enabled: employee.pfEnabled ?? (compliance?.pf?.enabled || false)
    });

    // ESI (Merge global settings with employee-specific overrides)
    const esiResult = calculateESI(grossEarnings, {
        ...compliance?.esi,
        wageLimit: employee.esiSalaryLimit ?? compliance?.esi?.wageLimit,
        enabled: employee.esiEnabled ?? (compliance?.esi?.enabled || false)
    });

    // PT
    const pt = calculatePT(grossEarnings, compliance?.professionalTax || {});

    // TDS
    const annualGross = grossEarnings * 12;
    const annualPF = pfResult.employeePF * 12;
    const taxableIncome = annualGross - annualPF; // Basic deduction for PF
    const tds = calculateTDS(taxableIncome, employee.taxRegime || 'new', compliance?.tds || {});

    const totalDeductions = pfResult.employeePF + esiResult.employeeESI + pt + tds;
    const netPay = grossEarnings - totalDeductions;

    return {
        earnings: { basic, hra, da, specialAllowance },
        grossEarnings,
        deductions: {
            pf: pfResult.employeePF,
            esi: esiResult.employeeESI,
            professionalTax: pt,
            tds,
        },
        employerContributions: {
            pf: pfResult.employerPF,
            esi: esiResult.employerESI,
            pfAdmin: pfResult.adminCharges,
            edli: pfResult.edliCharges,
        },
        totalDeductions,
        netPay,
        workingDays,
        presentDays,
    };
};

module.exports = {
    calculatePF,
    calculateESI,
    calculatePT,
    calculateTDS,
    calculateSalaryBreakdown,
};
