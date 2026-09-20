// Orchestrates the full Roth vs. Pre-tax comparison. Pure: inputs in, one plain
// result object out. Every number the UI shows comes from here.
//
// Inputs (all dollars are annual unless noted; rates are decimals):
//   grossIncome, filingStatus ('single' | 'mfj'), currentAge, retirementAge,
//   debtPayments, otherExpenses            — costs that end by retirement
//   savings                                — annual retirement savings, also the
//                                            contribution amount compared
//   currentType ('pretax' | 'roth')        — what `savings` currently is
//   accountType ('401k' | 'ira')           — for the contribution-limit check
//   knowsSocialSecurity (bool), socialSecurityBenefit — known benefit if any
//   returnRate                             — expected annual return, e.g. 0.07
//   otherPretaxBalance, otherRothBalance, otherTaxableBalance
//   year                                   — tax year (defaults to current year)
//
// No inflation is modeled: tax brackets, the SS benefit and the budget are held
// at today's values, so the return rate is best read as an after-inflation
// (real) return and every dollar figure as today's dollars.
import { calculateTaxFromGross, getMarginalRate } from './taxCalculations.js';
import { calculateFica } from './ficaTax.js';
import { estimateSocialSecurityBenefit } from './socialSecurity.js';
import { solveGrossWithdrawal } from './incomeNeed.js';
import { solvePortfolioWithdrawal } from './portfolioTax.js';
import { checkContributionLimit } from './contributionLimits.js';
import { futureValueAnnuity, futureValueLumpSum } from './growthCalculations.js';
import {
  ACCOUNT_TYPES,
  CONTRIBUTION_TYPES,
  FILING_STATUSES,
  LTCG_RATE,
  WITHDRAWAL_RATE,
} from './constants.js';

// Two after-tax figures within this share of each other are called "about even".
const EVEN_TOLERANCE = 0.005;

// Section 8. Given the amount the user saves and what it currently is, return
// both forms at the same take-home cost, using the CURRENT marginal rate t:
//   currently Roth (R)     -> equivalent Pre-tax P = R / (1 - t)
//   currently Pre-tax (P)  -> equivalent Roth   R = P * (1 - t)
export function calculatePaycheckEquivalents(amount, currentType, marginalRate) {
  if (currentType === 'roth') {
    return { roth: amount, pretax: amount / (1 - marginalRate) };
  }
  return { pretax: amount, roth: amount * (1 - marginalRate) };
}

export function validateInputs(inputs) {
  const errors = [];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  if (!isNum(inputs.grossIncome) || inputs.grossIncome <= 0) {
    errors.push('Enter your total gross income.');
  }
  if (!(inputs.filingStatus in FILING_STATUSES)) errors.push('Choose a filing status.');
  if (!isNum(inputs.currentAge) || inputs.currentAge < 16 || inputs.currentAge > 100) {
    errors.push('Enter your current age (16–100).');
  }
  if (!isNum(inputs.retirementAge) || inputs.retirementAge > 100) {
    errors.push('Enter your planned retirement age.');
  } else if (isNum(inputs.currentAge) && inputs.retirementAge <= inputs.currentAge) {
    errors.push('Retirement age must be after your current age.');
  }
  for (const [key, label] of [
    ['debtPayments', 'Debt payments'],
    ['otherExpenses', 'Other expenses'],
    ['savings', 'Savings for retirement'],
    ['otherPretaxBalance', 'Other Pre-tax balance'],
    ['otherRothBalance', 'Other Roth balance'],
    ['otherTaxableBalance', 'Other taxable balance'],
  ]) {
    if (!isNum(inputs[key]) || inputs[key] < 0) errors.push(`${label} can't be negative.`);
  }
  if (inputs.knowsSocialSecurity && (!isNum(inputs.socialSecurityBenefit) || inputs.socialSecurityBenefit < 0)) {
    errors.push('Enter your annual Social Security benefit.');
  }
  if (!(inputs.currentType in CONTRIBUTION_TYPES)) errors.push('Choose Pre-tax or Roth.');
  if (!(inputs.accountType in ACCOUNT_TYPES)) errors.push('Choose an account type.');
  if (!isNum(inputs.returnRate) || inputs.returnRate < 0 || inputs.returnRate > 0.2) {
    errors.push('Choose an expected return.');
  }
  return errors;
}

function winnerOf(rothValue, pretaxValue) {
  const larger = Math.max(rothValue, pretaxValue);
  if (larger === 0 || Math.abs(rothValue - pretaxValue) / larger < EVEN_TOLERANCE) return 'even';
  return rothValue > pretaxValue ? 'roth' : 'pretax';
}

export function compareRothVsTraditional(inputs) {
  const errors = validateInputs(inputs);
  if (errors.length > 0) return { valid: false, errors };

  const year = inputs.year ?? new Date().getFullYear();
  const {
    grossIncome, filingStatus, currentAge, retirementAge,
    debtPayments, otherExpenses, savings, currentType, accountType, returnRate,
  } = inputs;
  const years = retirementAge - currentAge;

  // 1. Current tax position. Take-home pay is gross income minus federal income
  // tax AND FICA: payroll tax comes out of every paycheck but stops when you
  // retire, so it must not be counted as spending you need to replace.
  const current = calculateTaxFromGross(grossIncome, filingStatus, year);
  const fica = calculateFica(grossIncome, filingStatus, year);
  const afterTaxCurrentIncome = grossIncome - current.tax - fica.total;
  const marginalRateNow = current.marginalRate;

  // 2. Social Security benefit (known, or estimated)
  let socialSecurity;
  if (inputs.knowsSocialSecurity) {
    socialSecurity = { annualBenefit: inputs.socialSecurityBenefit, estimated: false };
  } else {
    socialSecurity = {
      ...estimateSocialSecurityBenefit({ annualIncome: grossIncome, currentAge, retirementAge, year }),
      estimated: true,
    };
  }
  const ssBenefit = socialSecurity.annualBenefit;

  // 3. After-tax retirement income need (top-down budget). Floored at 0: if
  // current spending already exceeds income there is no need to model.
  const rawNeed = afterTaxCurrentIncome - debtPayments - otherExpenses - savings;
  const targetAfterTaxIncome = Math.max(0, rawNeed);

  // 8. Paycheck-equivalent contribution (both forms, regardless of current type)
  const contribution = calculatePaycheckEquivalents(savings, currentType, marginalRateNow);
  const { roth: R, pretax: P } = contribution;

  // 7. Contribution limit check (on the amount as entered)
  const limitCheck = checkContributionLimit(savings, accountType, year);

  // 4. Other accounts: grow to retirement, then take 4% from each
  const grown = {
    pretax: futureValueLumpSum(inputs.otherPretaxBalance, returnRate, years),
    roth: futureValueLumpSum(inputs.otherRothBalance, returnRate, years),
    taxable: futureValueLumpSum(inputs.otherTaxableBalance, returnRate, years),
  };
  const otherWithdrawals = {
    pretaxGross: WITHDRAWAL_RATE * grown.pretax, // fully taxable, stacks as ordinary income
    roth: WITHDRAWAL_RATE * grown.roth, // tax-free
    taxableGross: WITHDRAWAL_RATE * grown.taxable, // flat LTCG rate
  };
  // NOTE: no RMD sequencing or tax-efficient withdrawal ordering is modeled —
  // all accounts are treated as drawn simultaneously.

  // 5 + 6. Social Security taxability and the gross-up are solved jointly: this
  // account's own withdrawal feeds the combined-income test, so taxable SS can't
  // be fixed up front.
  const grossUp = solveGrossWithdrawal({
    targetAfterTaxIncome,
    ssBenefit,
    otherPretaxWithdrawal: otherWithdrawals.pretaxGross,
    otherRothWithdrawal: otherWithdrawals.roth,
    otherTaxableWithdrawal: otherWithdrawals.taxableGross,
    filingStatus,
    year,
    ltcgRate: LTCG_RATE,
  });
  const effectiveRateRetirement = grossUp.retirementEffectiveTaxRate;

  // 9. Calculation 1 — a single lump-sum contribution
  const lumpSum = {
    roth: {
      futureValue: futureValueLumpSum(R, returnRate, years),
    },
    pretax: {
      futureValueGross: futureValueLumpSum(P, returnRate, years),
    },
  };
  lumpSum.roth.afterTaxValue = lumpSum.roth.futureValue; // Roth is tax-free
  lumpSum.pretax.afterTaxValue = lumpSum.pretax.futureValueGross * (1 - effectiveRateRetirement);

  // 10. Calculation 2 — ongoing annual contributions
  const annuityRothFV = futureValueAnnuity(R, returnRate, years);
  const annuityPretaxFV = futureValueAnnuity(P, returnRate, years);
  const annuity = {
    roth: {
      futureValue: annuityRothFV,
      annualWithdrawal: WITHDRAWAL_RATE * annuityRothFV,
      afterTaxWithdrawal: WITHDRAWAL_RATE * annuityRothFV,
    },
    pretax: {
      futureValue: annuityPretaxFV,
      annualWithdrawal: WITHDRAWAL_RATE * annuityPretaxFV,
      afterTaxWithdrawal: WITHDRAWAL_RATE * annuityPretaxFV * (1 - effectiveRateRetirement),
    },
  };

  // 11. Full-portfolio tax comparison
  const scenarioBuckets = {
    roth: { pretax: grown.pretax, roth: grown.roth + annuityRothFV, taxable: grown.taxable },
    pretax: { pretax: grown.pretax + annuityPretaxFV, roth: grown.roth, taxable: grown.taxable },
  };
  const portfolio = {};
  for (const scenario of ['roth', 'pretax']) {
    const buckets = scenarioBuckets[scenario];
    portfolio[scenario] = {
      buckets,
      totalValue: buckets.pretax + buckets.roth + buckets.taxable,
      ...solvePortfolioWithdrawal(targetAfterTaxIncome, buckets, ssBenefit, filingStatus, year),
    };
  }

  // 12. "Simple view": the same comparison with Social Security left out entirely
  // (benefit = $0), so the retirement income number has to come from the accounts.
  // This strips out the Social Security phase-in and leaves plain brackets. The
  // retirement rate here is the MARGINAL rate: the bracket the last dollar of the
  // withdrawal lands in (the classic "rate now vs. rate later" rule of thumb).
  // It is the higher of the two rates ever shown, since the marginal rate is the
  // top-bracket rate applied to the whole withdrawal; the blended (effective) rate
  // is returned alongside for reference.
  const noSsGrossUp = solveGrossWithdrawal({
    targetAfterTaxIncome,
    ssBenefit: 0,
    otherPretaxWithdrawal: otherWithdrawals.pretaxGross,
    otherRothWithdrawal: otherWithdrawals.roth,
    otherTaxableWithdrawal: otherWithdrawals.taxableGross,
    filingStatus,
    year,
    ltcgRate: LTCG_RATE,
  });
  // Signed taxable income at the top of the stack: with no Social Security it is
  // just pre-tax withdrawals minus the standard deduction (negative = still sheltered).
  const noSsTopOfStack =
    otherWithdrawals.pretaxGross + noSsGrossUp.grossWithdrawal - current.standardDeduction;
  const noSsMarginalRate = getMarginalRate(noSsTopOfStack, filingStatus, year);
  const noSsPretaxAtMarginal = annuity.pretax.annualWithdrawal * (1 - noSsMarginalRate);
  const withoutSocialSecurity = {
    grossUp: noSsGrossUp,
    marginalRateRetirement: noSsMarginalRate,
    effectiveRateRetirement: noSsGrossUp.retirementEffectiveTaxRate,
    taxableIncomeAtTop: Math.max(0, noSsTopOfStack),
    annuity: {
      roth: { afterTaxWithdrawal: annuity.roth.afterTaxWithdrawal },
      pretax: {
        afterTaxWithdrawal: noSsPretaxAtMarginal, // at the marginal rate (the headline)
        afterTaxWithdrawalAtEffective:
          annuity.pretax.annualWithdrawal * (1 - noSsGrossUp.retirementEffectiveTaxRate),
      },
    },
    comparison: {
      winner: winnerOf(annuity.roth.afterTaxWithdrawal, noSsPretaxAtMarginal),
      afterTaxIncomeDifference: Math.abs(annuity.roth.afterTaxWithdrawal - noSsPretaxAtMarginal),
    },
  };

  const rothTax = portfolio.roth.totalTaxPaid;
  const pretaxTax = portfolio.pretax.totalTaxPaid;
  const taxDifference = {
    amount: Math.abs(rothTax - pretaxTax),
    // Which scenario pays LESS tax to fund the same lifestyle (within 50 cents = even).
    lowerTaxScenario:
      Math.abs(rothTax - pretaxTax) < 0.5 ? 'even' : rothTax < pretaxTax ? 'roth' : 'pretax',
  };

  return {
    valid: true,
    errors: [],
    year,
    dataYear: current.dataYear,
    years,
    current: { ...current, fica, afterTaxIncome: afterTaxCurrentIncome },
    socialSecurity,
    retirementNeed: {
      raw: rawNeed,
      target: targetAfterTaxIncome,
      // The budget walk from gross income to the retirement income number.
      breakdown: {
        grossIncome,
        incomeTax: current.tax,
        fica: fica.total,
        takeHome: afterTaxCurrentIncome,
        debtPayments,
        otherExpenses,
        savings,
      },
    },
    rates: { marginalNow: marginalRateNow, effectiveRetirement: effectiveRateRetirement },
    contribution,
    limitCheck,
    grown,
    otherWithdrawals,
    grossUp,
    lumpSum,
    annuity,
    // Section 2 verdict: who ends up with more after-tax annual income.
    comparison: {
      winner: winnerOf(annuity.roth.afterTaxWithdrawal, annuity.pretax.afterTaxWithdrawal),
      afterTaxIncomeDifference: Math.abs(
        annuity.roth.afterTaxWithdrawal - annuity.pretax.afterTaxWithdrawal,
      ),
    },
    portfolio,
    taxDifference,
    withoutSocialSecurity,
  };
}
