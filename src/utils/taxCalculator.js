const { 
    calculateEPF, 
    calculateESI, 
    calculatePT, 
    calculateLWF, 
    calculateStatutoryBonus
} = require('./statutoryCalc');

/**
 * Calculate complete salary breakdown
 * @param {object} employee - Employee object (with statutory overrides)
 * @param {object} config - StatutoryConfig object (global)
 * @param {number} workingDays - Total working days
 * @param {number} presentDays - Employee present days
 * @returns {object} Full salary breakdown
 */
const calculateSalaryBreakdown = (employee, config, workingDays = 26, presentDays = 26) => {
    const salary = employee.salary || {};
    const ratio = workingDays > 0 ? (presentDays || 0) / workingDays : 1;

    // 1. Pro-rate Earnings
    let basic = Math.round((salary.basic || 0) * ratio);
    const hra = Math.round((salary.hra || 0) * ratio);
    const da = Math.round((salary.da || 0) * ratio);
    const specialAllowance = Math.round((salary.specialAllowance || 0) * ratio);
    
    // Pro-rate PF wage if config says so
    let pfWage = basic;
    const empStat = employee.statutory || {};
    if (empStat.pf?.proRateRestrictedPFWage && presentDays < workingDays) {
        // Note: basic is already pro-rated above.
    }

    const grossEarnings = basic + hra + da + specialAllowance;

    // 2. EPF Calculation
    const epfResult = calculateEPF(pfWage, {
        ...config.epf,
        ...empStat.pf,
        epfEnabled: empStat.pf?.enabled ?? config.epf.epfEnabled
    });

    // 3. ESI Calculation
    const esiResult = calculateESI(grossEarnings, {
        ...config.esi,
        ...empStat.esi,
        esiEnabled: empStat.esi?.enabled ?? config.esi.esiEnabled
    });

    // 4. Professional Tax
    const ptAmount = calculatePT(grossEarnings, config.professionalTax.ptState, {
        ...config.professionalTax,
        ...empStat.pt,
        ptEnabled: empStat.pt?.enabled ?? config.professionalTax.ptEnabled
    });

    // 5. Labour Welfare Fund
    const lwfResult = calculateLWF({
        ...config.labourWelfareFund,
        ...empStat.lwf,
        lwfEnabled: empStat.lwf?.enabled ?? config.labourWelfareFund.lwfEnabled
    }, new Date().getMonth() + 1);

    // 6. Statutory Bonus
    const bonusAmount = calculateStatutoryBonus(basic, {
        ...config.statutoryBonus,
        ...empStat.statutoryBonus,
        statutoryBonusEnabled: empStat.statutoryBonus?.enabled ?? config.statutoryBonus.statutoryBonusEnabled
    });

    // 7. Income Tax (TDS)
    const annualGross = grossEarnings * 12;
    const annualPF = epfResult.employeeContribution.epf * 12;
    const tds = calculateTDS(annualGross - annualPF, employee.taxRegime || 'new', {});

    const totalDeductions = epfResult.employeeContribution.epf + esiResult.employeeESI + ptAmount + lwfResult.employeeLWF + tds;
    const netPay = grossEarnings - totalDeductions;

    return {
        earnings: { basic, hra, da, specialAllowance, bonus: bonusAmount },
        grossEarnings,
        deductions: {
            pf: epfResult.employeeContribution.epf,
            esi: esiResult.employeeESI,
            professionalTax: ptAmount,
            lwf: lwfResult.employeeLWF,
            tds: tds,
        },
        employerContributions: {
            pf: epfResult.employerContribution.eps + epfResult.employerContribution.epf + epfResult.employerContribution.edli + epfResult.employerContribution.adminCharges,
            eps: epfResult.employerContribution.eps,
            epf: epfResult.employerContribution.epf,
            edli: epfResult.employerContribution.edli,
            adminCharges: epfResult.employerContribution.adminCharges,
            esi: esiResult.employerESI,
            lwf: lwfResult.employerLWF,
        },
        bonus: bonusAmount,
        totalDeductions,
        netPay,
        workingDays,
        presentDays,
    };
};

/**
 * Calculate monthly TDS (Income Tax)
 */
const calculateTDS = (annualIncome, regime = 'new', tdsSettings = {}) => {
    const cessRate = 0.04;
    const newSlabs = [
        { minIncome: 0, maxIncome: 400000, rate: 0 },
        { minIncome: 400001, maxIncome: 800000, rate: 5 },
        { minIncome: 800001, maxIncome: 1200000, rate: 10 },
        { minIncome: 1200001, maxIncome: 1600000, rate: 15 },
        { minIncome: 1600001, maxIncome: 2000000, rate: 20 },
        { minIncome: 2000001, maxIncome: 2400000, rate: 25 },
        { minIncome: 2400001, maxIncome: 999999999, rate: 30 },
    ];
    
    let totalTax = 0;
    let remaining = annualIncome;
    for (const slab of newSlabs) {
        if (remaining <= 0) break;
        const slabRange = slab.maxIncome - slab.minIncome;
        const taxableInSlab = Math.min(remaining, slabRange);
        totalTax += taxableInSlab * (slab.rate / 100);
        remaining -= taxableInSlab;
    }
    if (annualIncome <= 1200000) totalTax = 0;
    totalTax = totalTax * (1 + cessRate);
    return Math.round(totalTax / 12);
};

module.exports = {
    calculateSalaryBreakdown,
    calculateTDS
};
