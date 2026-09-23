// Orchestrates the full Roth vs. Pre-tax comparison. Pure: inputs in, one plain
// result object out. Every number the UI shows comes from here.
//
// Inputs (all dollars are annual unless noted; rates are decimals):
//   grossIncome, filingStatus ('single' | 'mfj'), currentAge, retirementAge,
//   selfEmploymentIncome                   — the part of grossIncome that is 1099 (net) income;
//                                            the rest is W-2. Optional, default 0.
//   retirementLifestyle                    — retirement spending vs. today, as a multiplier
//                                            (1 = same, 1.25 = 25% higher). Optional, default 1.
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
import { calculateEmploymentTaxes } from './ficaTax.js';
import { estimateSocialSecurityBenefit } from './socialSecurity.js';
import { solveGrossWithdrawal } from './incomeNeed.js';
import { solvePortfolioWithdrawal } from './portfolioTax.js';
import { checkContributionLimit, splitAtContributionLimit } from './contributionLimits.js';
import { futureValueAnnuity, futureValueLumpSum } from './growthCalculations.js';
import {
  ACCOUNT_TYPES,
  CONTRIBUTION_TYPES,
  FILING_STATUSES,
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
  const se = inputs.selfEmploymentIncome ?? 0;
  if (!isNum(se) || se < 0) {
    errors.push('Enter your 1099 income.');
  } else if (isNum(inputs.grossIncome) && se > inputs.grossIncome) {
    errors.push("Your 1099 income can't be more than your total gross income.");
  }
  const lifestyle = inputs.retirementLifestyle ?? 1;
  if (!isNum(lifestyle) || lifestyle < 0.5 || lifestyle > 3) {
    errors.push('Choose an expected retirement lifestyle.');
  }
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
  // tax AND payroll tax (FICA for W-2 income, self-employment tax for 1099
  // income): it comes out of every paycheck but stops when you retire, so it must
  // not be counted as spending you need to replace. Half of any self-employment
  // tax is deducted before income tax.
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const lifestyleFactor = inputs.retirementLifestyle ?? 1;
  const fica = calculateEmploymentTaxes({
    wages: grossIncome - selfEmploymentIncome,
    selfEmploymentIncome,
    filingStatus,
    year,
  });
  const current = calculateTaxFromGross(
    grossIncome,
    filingStatus,
    year,
    fica.selfEmployment.deduction,
  );
  const afterTaxCurrentIncome = grossIncome - current.tax - fica.total;
  const marginalRateNow = current.marginalRate;

  // 2. Social Security benefit (known, or estimated)
  let socialSecurity;
  if (inputs.knowsSocialSecurity) {
    socialSecurity = { annualBenefit: inputs.socialSecurityBenefit, estimated: false };
  } else {
    socialSecurity = {
      // Earnings that count toward a benefit: W-2 wages plus net self-employment earnings.
      ...estimateSocialSecurityBenefit({
        annualIncome: grossIncome - selfEmploymentIncome + fica.selfEmployment.netEarnings,
        currentAge,
        retirementAge,
        year,
      }),
      estimated: true,
    };
  }
  const ssBenefit = socialSecurity.annualBenefit;

  // 3. After-tax retirement income need (top-down budget). Floored at 0: if
  // current spending already exceeds income there is no need to model. The optional
  // lifestyle factor scales it for people who expect to spend more (or less) in
  // retirement than they do today, e.g. because their earnings will rise.
  const rawNeed = afterTaxCurrentIncome - debtPayments - otherExpenses - savings;
  const needBeforeLifestyle = Math.max(0, rawNeed);
  const targetAfterTaxIncome = needBeforeLifestyle * lifestyleFactor;

  // 8. Paycheck-equivalent contribution (both forms, regardless of current type)
  const contribution = calculatePaycheckEquivalents(savings, currentType, marginalRateNow);
  const { roth: R, pretax: P } = contribution;

  // 7. Contribution limit check (on the amount as entered). Includes any
  // catch-up contribution the saver's CURRENT age qualifies for — like the
  // base limit and tax brackets elsewhere, this is a snapshot at today's age,
  // held constant across the whole projection (it does not model aging into,
  // or out of, a catch-up tier over a multi-decade horizon).
  const limitCheck = checkContributionLimit(savings, accountType, year, currentAge);

  // Neither R nor P can legally exceed the IRS limit for this account type (the
  // limit is the same dollar figure whether the account is Roth or Traditional).
  // Anything above it is modeled as an additional contribution to a taxable
  // account instead — split independently for each hypothetical scenario, so
  // "all-Roth" and "all-Pre-tax" each realistically hit the same wall on their
  // own terms. contribution.roth/.pretax (above) stay the UNCAPPED paycheck
  // equivalents for display ("what would this cost in the other type"); the
  // capped amounts below are what actually compounds inside the account.
  const rothSplit = splitAtContributionLimit(R, accountType, year, currentAge);
  const pretaxSplit = splitAtContributionLimit(P, accountType, year, currentAge);
  const contributionSplit = { roth: rothSplit, pretax: pretaxSplit };

  // 10 (hoisted). This account's own future value doesn't depend on the tax
  // solve below, so it's computed early and its natural 4% annual withdrawal
  // is fed into the gross-up solver as the withdrawal size to measure the
  // rate on — see the `probeSize` note in incomeNeed.js. Without this, the
  // solver falls back to a fixed, arbitrary $1,000 probe whenever other
  // income already covers the target (gross-up = $0), which can read a very
  // different — and confusingly unstable — rate than the size this account
  // will actually be asked to deliver.
  const annuityRothFV = futureValueAnnuity(rothSplit.toAccount, returnRate, years);
  const annuityPretaxFV = futureValueAnnuity(pretaxSplit.toAccount, returnRate, years);
  const accountPretaxAnnualWithdrawal = WITHDRAWAL_RATE * annuityPretaxFV;
  // The excess beyond the limit, growing in a taxable account instead — one
  // stream per scenario, since a Roth-only saver and a Pre-tax-only saver spill
  // over by different amounts (R and P differ once converted at the same
  // take-home cost).
  const excessRothTaxableFV = futureValueAnnuity(rothSplit.excessToTaxable, returnRate, years);
  const excessPretaxTaxableFV = futureValueAnnuity(pretaxSplit.excessToTaxable, returnRate, years);

  // 4. Other accounts: grow to retirement, then take 4% from each
  const grown = {
    pretax: futureValueLumpSum(inputs.otherPretaxBalance, returnRate, years),
    roth: futureValueLumpSum(inputs.otherRothBalance, returnRate, years),
    taxable: futureValueLumpSum(inputs.otherTaxableBalance, returnRate, years),
  };
  const otherWithdrawals = {
    pretaxGross: WITHDRAWAL_RATE * grown.pretax, // fully taxable, stacks as ordinary income
    roth: WITHDRAWAL_RATE * grown.roth, // tax-free
    taxableGross: WITHDRAWAL_RATE * grown.taxable, // treated as capital gain, taxed via real LTCG brackets
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
    probeSize: accountPretaxAnnualWithdrawal,
  });
  const effectiveRateRetirement = grossUp.retirementEffectiveTaxRate;

  // Overall effective rate in retirement: all tax owed on the whole first-year
  // retirement stack (with this account's withdrawal) divided by the gross income
  // received: Social Security plus every withdrawal, Roth included.
  const retirementGrossIncome =
    ssBenefit +
    otherWithdrawals.pretaxGross +
    otherWithdrawals.roth +
    otherWithdrawals.taxableGross +
    grossUp.grossWithdrawal;
  const overallEffectiveRateRetirement =
    retirementGrossIncome > 0 ? grossUp.solutionStack.totalTax / retirementGrossIncome : 0;

  // 9. Calculation 1 — a single lump-sum contribution (capped at the IRS limit)
  const lumpSum = {
    roth: {
      futureValue: futureValueLumpSum(rothSplit.toAccount, returnRate, years),
    },
    pretax: {
      futureValueGross: futureValueLumpSum(pretaxSplit.toAccount, returnRate, years),
    },
  };
  lumpSum.roth.afterTaxValue = lumpSum.roth.futureValue; // Roth is tax-free
  lumpSum.pretax.afterTaxValue = lumpSum.pretax.futureValueGross * (1 - effectiveRateRetirement);

  // 10. Calculation 2 — ongoing annual contributions (capped at the IRS limit;
  // FVs were hoisted above, before the gross-up solve — see the comment there)
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

  // 11. Full-portfolio tax comparison. Each scenario's taxable bucket picks up
  // its own excess-over-the-limit contributions (0 when nothing was capped).
  const scenarioBuckets = {
    roth: {
      pretax: grown.pretax,
      roth: grown.roth + annuityRothFV,
      taxable: grown.taxable + excessRothTaxableFV,
    },
    pretax: {
      pretax: grown.pretax + annuityPretaxFV,
      roth: grown.roth,
      taxable: grown.taxable + excessPretaxTaxableFV,
    },
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

  // 12. "Years without Social Security": the same comparison with Social Security
  // left out entirely (benefit = $0) — e.g. retirement years before benefits start —
  // so the retirement income number has to come from the accounts. This strips out
  // the Social Security phase-in and leaves plain brackets. The headline retirement
  // rate is the BLENDED (effective) rate on this account's withdrawal, exactly as in
  // the main comparison but with no phase-in. The marginal bracket of the last dollar
  // is returned too, and the after-tax figure at that rate, for reference only.
  const noSsGrossUp = solveGrossWithdrawal({
    targetAfterTaxIncome,
    ssBenefit: 0,
    otherPretaxWithdrawal: otherWithdrawals.pretaxGross,
    otherRothWithdrawal: otherWithdrawals.roth,
    otherTaxableWithdrawal: otherWithdrawals.taxableGross,
    filingStatus,
    year,
    probeSize: accountPretaxAnnualWithdrawal,
  });
  // Signed taxable income at the top of the stack: with no Social Security it is
  // just pre-tax withdrawals minus the standard deduction (negative = still sheltered).
  const noSsTopOfStack =
    otherWithdrawals.pretaxGross + noSsGrossUp.grossWithdrawal - current.standardDeduction;
  const noSsMarginalRate = getMarginalRate(noSsTopOfStack, filingStatus, year);
  const noSsPretaxAtMarginal = annuity.pretax.annualWithdrawal * (1 - noSsMarginalRate);
  const noSsPretaxAtEffective =
    annuity.pretax.annualWithdrawal * (1 - noSsGrossUp.retirementEffectiveTaxRate);
  const withoutSocialSecurity = {
    grossUp: noSsGrossUp,
    marginalRateRetirement: noSsMarginalRate,
    effectiveRateRetirement: noSsGrossUp.retirementEffectiveTaxRate,
    taxableIncomeAtTop: Math.max(0, noSsTopOfStack),
    annuity: {
      roth: { afterTaxWithdrawal: annuity.roth.afterTaxWithdrawal },
      pretax: {
        afterTaxWithdrawal: noSsPretaxAtEffective, // at the blended rate (the headline)
        afterTaxWithdrawalAtMarginal: noSsPretaxAtMarginal, // reference only
      },
    },
    comparison: {
      winner: winnerOf(annuity.roth.afterTaxWithdrawal, noSsPretaxAtEffective),
      afterTaxIncomeDifference: Math.abs(annuity.roth.afterTaxWithdrawal - noSsPretaxAtEffective),
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
      beforeLifestyleAdjustment: needBeforeLifestyle,
      lifestyleFactor,
      // The budget walk from gross income to the retirement income number.
      breakdown: {
        grossIncome,
        incomeTax: current.tax,
        fica: fica.total,
        selfEmploymentTax: fica.selfEmployment.tax,
        selfEmploymentDeduction: fica.selfEmployment.deduction,
        selfEmploymentIncome,
        takeHome: afterTaxCurrentIncome,
        debtPayments,
        otherExpenses,
        savings,
      },
    },
    // effectiveRetirement = tax caused by THIS account's withdrawals / those withdrawals.
    // overallEffectiveRetirement = total tax / total gross income in retirement.
    rates: {
      marginalNow: marginalRateNow,
      effectiveRetirement: effectiveRateRetirement,
      overallEffectiveRetirement: overallEffectiveRateRetirement,
    },
    retirementOverall: {
      totalTax: grossUp.solutionStack.totalTax,
      grossIncome: retirementGrossIncome,
    },
    contribution,
    contributionSplit,
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
