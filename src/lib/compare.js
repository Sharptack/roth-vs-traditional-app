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
//   otherPretaxBalance, otherRothBalance, otherTaxableBalance  — the Existing Accounts
//   otherTaxableBasis                      — share of today's taxable balance that is cost
//                                            basis (0–1). Optional, default 0 = all gain.
//   year                                   — tax year (defaults to current year)
//   earners                                — OPTIONAL (household model, phase 1): one entry per
//                                            earner, [{ wages, selfEmploymentIncome, currentAge,
//                                            claimAge, knowsSocialSecurity, socialSecurityBenefit }].
//                                            When given, payroll tax and Social Security are figured
//                                            per person (own wage base, spousal top-up) and the flat
//                                            knowsSocialSecurity/socialSecurityBenefit are ignored.
//                                            grossIncome/selfEmploymentIncome must be their sums.
//                                            Absent = today's single-earner behavior, unchanged.
//   contributors                           — OPTIONAL (household model, phase 1): who makes the
//                                            Future Contributions, [{ amount, age, label,
//                                            currentType?, accountType? }]. Each
//                                            person's amount is split at THEIR OWN IRS limit (own
//                                            catch-up age); the household figures are the sums.
//                                            `savings` must equal the sum of the amounts.
//                                            Absent = one saver at currentAge, unchanged.
//   taxSavedAcrossContribution             — OPTIONAL (the #/next preview), boolean: measure the tax a
//                                            Pre-tax contribution saves across the WHOLE contribution
//                                            (tax without it − tax with it) instead of applying the
//                                            top-of-bracket marginal rate to every dollar. A deduction
//                                            that crosses a bracket edge saves less than the marginal
//                                            rate. Absent/false = today's marginal-rate rule, unchanged.
//   retirementTaxRules                     — OPTIONAL (the #/next preview): { thresholdScale,
//                                            rateShift, ages } for the retirement-year tax, run
//                                            through the single-year engine (calculateRetirementTax's
//                                            taxRules). Absent = today's retirement tax, unchanged.
//   skipBlend                              — OPTIONAL, boolean: don't compute the Roth/Pre-tax blend
//                                            explorer (result.blend = { available: false }). It is most
//                                            of this function's run time and only the preview's Roth
//                                            page shows it. Absent/false = computed, as before.
//
// No inflation is modeled: tax brackets, the SS benefit and the budget are held
// at today's values, so the return rate is best read as an after-inflation
// (real) return and every dollar figure as today's dollars.
import { calculateTaxFromGross } from './taxCalculations.js';
import { calculateEmploymentTaxes, calculateHouseholdEmploymentTaxes } from './ficaTax.js';
import { estimateHouseholdSocialSecurity, estimateSocialSecurityBenefit } from './socialSecurity.js';
import { solvePortfolioWithdrawal } from './portfolioTax.js';
import { calculateSideAwareRates } from './sideAwareRates.js';
import { findOptimalBlend } from './blend.js';
import { calculateRetirementTax } from './retirementTaxStack.js';
import { checkContributionLimit, combineLimitChecks, splitAtContributionLimit } from './contributionLimits.js';
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

// Splits the savings into what goes in the account and what spills over to a
// taxable account, for each scenario, at the SAME take-home cost C:
//   currently Roth:    C = savings (all after-tax)
//   currently Pre-tax: C = min(savings, limit) x (1 - t) + max(0, savings - limit)
//                      (only the part under the limit is deducted; the rest is after-tax money)
//   Roth scenario:    min(C, limit) to the account, the rest of C to taxable
//   Pre-tax scenario: min(C / (1 - t), limit) to the account, costing that x (1 - t);
//                     the rest of C to taxable. At the limit, that remainder is the tax
//                     the Pre-tax contribution saved, invested in a taxable account.
// -> { takeHomeCost, roth: { toAccount, excessToTaxable }, pretax: { toAccount, excessToTaxable } }
export function splitAtTakeHome(savings, currentType, marginalRate, limit) {
  const S = Math.max(0, savings);
  const keep = 1 - marginalRate;
  const takeHomeCost = currentType === 'roth' ? S : Math.min(S, limit) * keep + Math.max(0, S - limit);
  const rothToAccount = Math.min(takeHomeCost, limit);
  // Exact when the Pre-tax side fits: the saver's own Pre-tax savings, or the Roth savings grossed up.
  const pretaxUncapped =
    currentType === 'pretax' && S <= limit ? S : calculatePaycheckEquivalents(takeHomeCost, 'roth', marginalRate).pretax;
  const pretaxToAccount = Math.min(pretaxUncapped, limit);
  return {
    takeHomeCost,
    roth: { toAccount: rothToAccount, excessToTaxable: takeHomeCost - rothToAccount },
    pretax: {
      toAccount: pretaxToAccount,
      excessToTaxable: pretaxUncapped <= limit ? 0 : takeHomeCost - pretaxToAccount * keep,
    },
  };
}

// splitAtTakeHome per person, each at their own IRS limit, summed for the household (they file
// one joint return, so the marginal rate is shared). people[i] is that person's own split.
//   contributors: [{ amount, limit }]
// A contributor may carry their own currentType (how THEIR savings are held today); otherwise
// the household's applies.
export function splitAtTakeHomeByPerson(contributors, currentType, marginalRate) {
  const people = contributors.map((c) => splitAtTakeHome(c.amount, c.currentType ?? currentType, marginalRate, c.limit));
  const sum = (pick) => people.reduce((acc, p) => acc + pick(p), 0);
  return {
    takeHomeCost: sum((p) => p.takeHomeCost),
    roth: { toAccount: sum((p) => p.roth.toAccount), excessToTaxable: sum((p) => p.roth.excessToTaxable) },
    pretax: { toAccount: sum((p) => p.pretax.toAccount), excessToTaxable: sum((p) => p.pretax.excessToTaxable) },
    people,
  };
}

// The rate a Pre-tax contribution saves, averaged across the whole contribution (preview option).
// The Pre-tax amount depends on the rate (the same take-home cost buys more Pre-tax dollars at a
// higher rate), and the rate on the amount, so this finds the fixed point: the rate t at which
// splitAt(t) puts A in the Pre-tax account and savedByDeduction(A) / A = t. Every split function
// already takes a rate, so they are reused unchanged. Converges in a few steps (the saved rate
// moves far less than the amount does).
//   splitAt(t) -> a split with pretax.toAccount; savedByDeduction(x) -> tax saved by deducting x.
export function averageRateFixedPoint(splitAt, savedByDeduction, startRate, pretaxOf = (s) => s.pretax.toAccount) {
  let t = startRate;
  let split = splitAt(t);
  for (let i = 0; i < 100; i++) {
    const A = pretaxOf(split);
    const next = A > 0 ? savedByDeduction(A) / A : t;
    if (Math.abs(next - t) < 1e-13) break;
    t = next;
    split = splitAt(t);
  }
  return { rate: t, split };
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
  const basis = inputs.otherTaxableBasis ?? 0;
  if (!isNum(basis) || basis < 0 || basis > 1) {
    errors.push('Choose the cost basis of your existing taxable accounts (0–100%).');
  }
  if (inputs.earners === undefined) {
    if (inputs.knowsSocialSecurity && (!isNum(inputs.socialSecurityBenefit) || inputs.socialSecurityBenefit < 0)) {
      errors.push('Enter your annual Social Security benefit.');
    }
  } else {
    for (const e of inputs.earners) {
      if (!isNum(e.wages) || e.wages < 0 || !isNum(e.selfEmploymentIncome) || e.selfEmploymentIncome < 0) {
        errors.push("Each person's income can't be negative.");
      }
      if (!isNum(e.currentAge) || !isNum(e.claimAge)) errors.push("Enter each person's age and retirement age.");
      if (e.knowsSocialSecurity && (!isNum(e.socialSecurityBenefit) || e.socialSecurityBenefit < 0)) {
        errors.push("Enter each person's annual Social Security benefit.");
      }
    }
  }
  if (!(inputs.currentType in CONTRIBUTION_TYPES)) errors.push('Choose Pre-tax or Roth.');
  if (!(inputs.accountType in ACCOUNT_TYPES)) errors.push('Choose an account type.');
  if (!isNum(inputs.returnRate) || inputs.returnRate < 0 || inputs.returnRate > 0.2) {
    errors.push('Choose an expected return.');
  }
  return errors;
}

// Which way the two headline rates lean, before any dollars are compared:
// Pre-tax when the effective rate on this account's withdrawals is below the
// marginal rate while working, Roth when above. Within half a percentage point
// the two are called "even". This is the rule of thumb, not the verdict: the
// dollar comparison can differ, e.g. when the contribution limit caps one side.
export function leanFromRates(marginalNow, effectiveRetirement) {
  const gap = marginalNow - effectiveRetirement;
  if (Math.abs(gap) < EVEN_TOLERANCE) return 'even';
  return gap > 0 ? 'pretax' : 'roth';
}

export function winnerOf(rothValue, pretaxValue) {
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
  //
  // Savings that are currently Pre-tax are deducted before income tax too (but
  // not before FICA: 401(k)/IRA deferrals are still payroll-taxed wages). Only the
  // part that fits under the IRS limit is deductible; anything above it is
  // modeled as going to a taxable account (see step 7), so it is not deducted.
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const lifestyleFactor = inputs.retirementLifestyle ?? 1;
  const fica = inputs.earners
    ? calculateHouseholdEmploymentTaxes({ earners: inputs.earners, filingStatus, year })
    : calculateEmploymentTaxes({
        wages: grossIncome - selfEmploymentIncome,
        selfEmploymentIncome,
        filingStatus,
        year,
      });
  // Who saves (household model): each person's amount at their own limit. Absent = one saver.
  const contributors = inputs.contributors?.map((c) => ({
    ...c,
    // Each person may have their own account type and Roth/Pre-tax type (default: the household's).
    limitCheck: checkContributionLimit(c.amount, c.accountType ?? accountType, year, c.age),
  }));
  const pretaxDeduction = contributors
    ? contributors
        .filter((c) => (c.currentType ?? currentType) === 'pretax')
        .reduce((acc, c) => acc + Math.min(Math.max(0, c.amount), c.limitCheck.limit), 0)
    : currentType !== 'pretax'
      ? 0
      : splitAtContributionLimit(savings, accountType, year, currentAge).toAccount;
  const withContribution = calculateTaxFromGross(
    grossIncome,
    filingStatus,
    year,
    fica.selfEmployment.deduction + pretaxDeduction,
  );
  // Income tax as if the savings were NOT deducted, i.e. the top of your pay
  // before any Pre-tax contribution comes off it. Its marginal rate is the rate
  // a Pre-tax contribution saves (and a Roth contribution pays), so it is the
  // "marginal rate while working" whichever way the savings are held today.
  const withoutContribution = calculateTaxFromGross(
    grossIncome,
    filingStatus,
    year,
    fica.selfEmployment.deduction,
  );
  const marginalRateNow = withoutContribution.marginalRate;
  const current = { ...withContribution, marginalRate: marginalRateNow, pretaxDeduction };
  const afterTaxCurrentIncome = grossIncome - current.tax - fica.total;

  // 2. Social Security benefit (known, or estimated)
  let socialSecurity;
  if (inputs.earners) {
    // Per person: each earner's own covered earnings (wages + net self-employment earnings).
    socialSecurity = estimateHouseholdSocialSecurity({
      earners: inputs.earners.map((e, i) => ({
        ...e,
        earnings: e.wages + fica.people[i].selfEmployment.netEarnings,
      })),
      year,
    });
  } else if (inputs.knowsSocialSecurity) {
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

  // 7. Contribution limit check (on the amount as entered). Includes any
  // catch-up contribution the saver's CURRENT age qualifies for — like the
  // base limit and tax brackets elsewhere, this is a snapshot at today's age,
  // held constant across the whole projection (it does not model aging into,
  // or out of, a catch-up tier over a multi-decade horizon).
  const limitCheck = contributors
    ? combineLimitChecks(contributors.map((c) => ({ label: c.label, check: c.limitCheck })))
    : checkContributionLimit(savings, accountType, year, currentAge);

  // 8. Both forms at the same take-home cost. Neither can legally exceed the IRS
  // limit (the same dollar figure for Roth or Traditional); what doesn't fit goes
  // to a taxable account, independently per scenario (see splitAtTakeHome).
  // contribution.roth/.pretax = everything that scenario puts away per year
  // (account + taxable side); the split says where it goes.
  const splitAt = (t) =>
    contributors
      ? splitAtTakeHomeByPerson(
          contributors.map((c) => ({ amount: c.amount, limit: c.limitCheck.limit, currentType: c.currentType })),
          currentType,
          t,
        )
      : splitAtTakeHome(savings, currentType, t, limitCheck.limit);
  // Tax a Pre-tax deduction of x saves this year (the whole deduction, across bracket edges).
  const savedByDeduction = (x) =>
    withoutContribution.tax -
    calculateTaxFromGross(grossIncome, filingStatus, year, fica.selfEmployment.deduction + x).tax;
  // The rate the contribution saves: the marginal rate (today's rule), or averaged across the
  // whole contribution (preview option taxSavedAcrossContribution).
  const { rate: contributionRate, split: contributionSplit } = inputs.taxSavedAcrossContribution
    ? averageRateFixedPoint(splitAt, savedByDeduction, marginalRateNow)
    : { rate: marginalRateNow, split: splitAt(marginalRateNow) };
  const { roth: rothSplit, pretax: pretaxSplit } = contributionSplit;
  const contribution = {
    roth: rothSplit.toAccount + rothSplit.excessToTaxable,
    pretax: pretaxSplit.toAccount + pretaxSplit.excessToTaxable,
  };

  // 9-10 (hoisted). Both accounts' natural 4% withdrawals, and each scenario's taxable
  // "side" account (the part of Future Contributions that spilled over the IRS limit —
  // one stream per scenario, since a Roth-only saver and a Pre-tax-only saver spill over by
  // different amounts, R and P differing once converted at the same take-home cost), are
  // needed by the rate calculation below, so they're computed first.
  const annuityRothFV = futureValueAnnuity(rothSplit.toAccount, returnRate, years);
  const annuityPretaxFV = futureValueAnnuity(pretaxSplit.toAccount, returnRate, years);
  const accountRothAnnualWithdrawal = WITHDRAWAL_RATE * annuityRothFV;
  const accountPretaxAnnualWithdrawal = WITHDRAWAL_RATE * annuityPretaxFV;
  const excessRothTaxableFV = futureValueAnnuity(rothSplit.excessToTaxable, returnRate, years);
  const excessPretaxTaxableFV = futureValueAnnuity(pretaxSplit.excessToTaxable, returnRate, years);
  // Every dollar contributed to a side account is cost basis, so only its growth is gain.
  const sideRaw = (split, fv) => {
    const annualWithdrawal = WITHDRAWAL_RATE * fv;
    const gainShare = fv > 0 ? Math.max(0, 1 - (split.excessToTaxable * years) / fv) : 1;
    return {
      contribution: split.excessToTaxable,
      basis: split.excessToTaxable * years,
      futureValue: fv,
      annualWithdrawal,
      gainShare,
      gains: annualWithdrawal * gainShare,
    };
  };
  const rothSideRaw = sideRaw(rothSplit, excessRothTaxableFV);
  const pretaxSideRaw = sideRaw(pretaxSplit, excessPretaxTaxableFV);

  // 4. Other accounts: grow to retirement, then take 4% from each
  const grown = {
    pretax: futureValueLumpSum(inputs.otherPretaxBalance, returnRate, years),
    roth: futureValueLumpSum(inputs.otherRothBalance, returnRate, years),
    taxable: futureValueLumpSum(inputs.otherTaxableBalance, returnRate, years),
  };
  // Cost basis of the taxable Existing Accounts: a share of TODAY's balance; all
  // growth from here on is gain. Withdrawals are split pro-rata between basis
  // (untaxed) and gain (capital gain), so gain share = 1 − basis / grown balance.
  const existingTaxableBasis = inputs.otherTaxableBalance * (inputs.otherTaxableBasis ?? 0);
  const existingGainShare = grown.taxable > 0 ? Math.max(0, 1 - existingTaxableBasis / grown.taxable) : 1;
  const otherWithdrawals = {
    pretaxGross: WITHDRAWAL_RATE * grown.pretax, // fully taxable, stacks as ordinary income
    roth: WITHDRAWAL_RATE * grown.roth, // tax-free
    taxableGross: WITHDRAWAL_RATE * grown.taxable, // gain part taxed via real LTCG brackets
    taxableGains: WITHDRAWAL_RATE * grown.taxable * existingGainShare,
    taxableGainShare: existingGainShare,
  };
  // NOTE: no RMD sequencing or tax-efficient withdrawal ordering is modeled —
  // all accounts are treated as drawn simultaneously.

  // Roth/Pre-tax blend explorer (blend.js): mixes this year's contribution between Roth and
  // Pre-tax within the SAME account, at the SAME take-home cost as today's actual
  // savings/currentType (contributionSplit.takeHomeCost) — a genuine "what if you split this
  // same budget differently" exploration, not a separate what-if income. Skipped when there is
  // nothing to split ($0 saved).
  let blend = { available: false };
  if (!inputs.skipBlend && contributionSplit.takeHomeCost > 0.5) {
    const existingOnlyTax = calculateRetirementTax({
      pretaxWithdrawal: otherWithdrawals.pretaxGross,
      taxableWithdrawal: otherWithdrawals.taxableGross,
      taxableGainShare: otherWithdrawals.taxableGainShare,
      ssBenefit,
      filingStatus,
      year,
      taxRules: inputs.retirementTaxRules,
    }).totalTax;
    const { points, best } = findOptimalBlend({
      takeHomeCost: contributionSplit.takeHomeCost,
      marginalRate: contributionRate,
      limit: limitCheck.limit,
      // Preview option: each mix's Pre-tax part saves its own average rate.
      ...(inputs.taxSavedAcrossContribution && { savedByDeduction }),
      // Per person, each at their own limit (household model); absent = one limit, as today.
      ...(contributionSplit.people && {
        contributors: contributionSplit.people.map((p, i) => ({
          takeHomeCost: p.takeHomeCost,
          limit: contributors[i].limitCheck.limit,
        })),
      }),
      returnRate,
      years,
      other: otherWithdrawals,
      existingTax: existingOnlyTax,
      ssBenefit,
      filingStatus,
      year,
      taxRules: inputs.retirementTaxRules,
    });
    blend = { available: true, points, best };
  }

  // 5+6+9+10. The rates, and the after-tax dollars they imply for Future Contributions'
  // account + its taxable side account, together (sideAwareRates.js). Wrapped in a function
  // because "Retirement years without Social Security" below needs the exact same thing with
  // ssBenefit = 0 — everything else (the accounts, their side accounts, Existing Accounts) is
  // identical between the two views; only Social Security differs.
  const buildScenario = (ssBenefitForThisView) => {
    const sideAware = calculateSideAwareRates({
      other: otherWithdrawals,
      ssBenefit: ssBenefitForThisView,
      filingStatus,
      year,
      pretaxAccountWithdrawal: accountPretaxAnnualWithdrawal,
      rothAccountWithdrawal: accountRothAnnualWithdrawal,
      pretaxSide: { withdrawal: pretaxSideRaw.annualWithdrawal, gains: pretaxSideRaw.gains },
      rothSide: { withdrawal: rothSideRaw.annualWithdrawal, gains: rothSideRaw.gains },
      taxRules: inputs.retirementTaxRules,
    });
    if (!sideAware.available) {
      // $0 saved (or an equivalent edge case): there is nothing to measure, so every
      // downstream dollar figure is 0.
      const zeroSide = (raw) => ({ ...raw, taxRate: 0, afterTaxWithdrawal: 0 });
      return {
        sideAware,
        annuity: {
          roth: { afterTaxWithdrawal: 0, side: zeroSide(rothSideRaw), totalAfterTaxIncome: 0 },
          pretax: { afterTaxWithdrawal: 0, side: zeroSide(pretaxSideRaw), totalAfterTaxIncome: 0 },
        },
      };
    }
    sideAware.lean = leanFromRates(sideAware.taxSavedNow, sideAware.effectiveRate);

    // Attribute the total tax to the account and each side account by the SAME stacking
    // order sideAware used to compute effectiveRate/extraSideRate (Existing Accounts -> this
    // scenario's side account -> (Pre-tax only) the account's own withdrawal), so the two
    // pieces' after-tax dollars always sum EXACTLY to the total (tested to the cent against
    // portfolioTax's independently-solved `atBaseline` figure, across 700+ inputs).
    const st = sideAware.stacks;
    const accountTax = st.preTaxWorld.totalTax - st.preTaxWorldBeforeAccount.totalTax;
    const pretaxSideTax = st.preTaxWorldBeforeAccount.totalTax - st.existing.totalTax;
    const rothSideTax = st.rothWorld.totalTax - st.existing.totalTax;
    const withTax = (raw, tax) => {
      const taxRate = raw.annualWithdrawal > 0 ? tax / raw.annualWithdrawal : 0;
      return { ...raw, taxRate, afterTaxWithdrawal: raw.annualWithdrawal * (1 - taxRate) };
    };
    const rothSide = withTax(rothSideRaw, rothSideTax);
    const pretaxSide = withTax(pretaxSideRaw, pretaxSideTax);
    return {
      sideAware,
      annuity: {
        roth: {
          afterTaxWithdrawal: accountRothAnnualWithdrawal, // tax-free
          side: rothSide,
          totalAfterTaxIncome: accountRothAnnualWithdrawal + rothSide.afterTaxWithdrawal,
        },
        pretax: {
          afterTaxWithdrawal: accountPretaxAnnualWithdrawal - accountTax,
          side: pretaxSide,
          totalAfterTaxIncome: accountPretaxAnnualWithdrawal - accountTax + pretaxSide.afterTaxWithdrawal,
        },
      },
    };
  };

  const main = buildScenario(ssBenefit);

  // Overall effective rate in retirement (Pre-tax scenario): all tax on the whole first-year
  // retirement stack — Social Security, Existing Accounts, and Future Contributions' account
  // plus its side account — divided by the gross income received (Roth withdrawals included,
  // though untaxed: this is "share of everything you receive," not "share of taxable income").
  const retirementGrossIncome =
    ssBenefit +
    otherWithdrawals.pretaxGross +
    otherWithdrawals.roth +
    otherWithdrawals.taxableGross +
    pretaxSideRaw.annualWithdrawal +
    accountPretaxAnnualWithdrawal;
  const overallEffectiveRateRetirement =
    main.sideAware.available && retirementGrossIncome > 0
      ? main.sideAware.stacks.preTaxWorld.totalTax / retirementGrossIncome
      : 0;

  // 9. Calculation 1 — a single lump-sum contribution (capped at the IRS limit), taxed the
  // same way the account's own withdrawal is (main.sideAware.effectiveRate): it's the same
  // hypothetical, one year's contribution grown then withdrawn like the account.
  const lumpSum = {
    roth: {
      futureValue: futureValueLumpSum(rothSplit.toAccount, returnRate, years),
    },
    pretax: {
      futureValueGross: futureValueLumpSum(pretaxSplit.toAccount, returnRate, years),
    },
  };
  lumpSum.roth.afterTaxValue = lumpSum.roth.futureValue; // Roth is tax-free
  lumpSum.pretax.afterTaxValue =
    lumpSum.pretax.futureValueGross * (1 - (main.sideAware.available ? main.sideAware.effectiveRate : 0));

  // 10. Calculation 2 — ongoing annual contributions (capped at the IRS limit).
  const annuity = {
    roth: {
      futureValue: annuityRothFV,
      annualWithdrawal: accountRothAnnualWithdrawal,
      ...main.annuity.roth,
      totalFutureValue: annuityRothFV + excessRothTaxableFV,
    },
    pretax: {
      futureValue: annuityPretaxFV,
      annualWithdrawal: accountPretaxAnnualWithdrawal,
      ...main.annuity.pretax,
      totalFutureValue: annuityPretaxFV + excessPretaxTaxableFV,
    },
  };
  for (const [scenario, split] of [
    ['roth', rothSplit],
    ['pretax', pretaxSplit],
  ]) {
    const a = annuity[scenario];
    const l = lumpSum[scenario];
    const lumpSideFV = futureValueLumpSum(split.excessToTaxable, returnRate, years);
    l.side = { futureValue: lumpSideFV, afterTaxValue: lumpSideFV * (1 - a.side.taxRate) };
    l.totalFutureValue = (l.futureValue ?? l.futureValueGross) + lumpSideFV;
    l.totalAfterTaxValue = l.afterTaxValue + l.side.afterTaxValue;
  }

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
    // Cost basis in the taxable bucket: the Existing Accounts' basis plus every
    // dollar of Future Contributions that spilled over the limit.
    const taxableBasis = existingTaxableBasis + annuity[scenario].side.basis;
    const taxableGainShare = buckets.taxable > 0 ? Math.max(0, 1 - taxableBasis / buckets.taxable) : 1;
    portfolio[scenario] = {
      buckets,
      totalValue: buckets.pretax + buckets.roth + buckets.taxable,
      taxableBasis,
      taxableGainShare,
      ...solvePortfolioWithdrawal(targetAfterTaxIncome, buckets, ssBenefit, filingStatus, year, {
        taxableGainShare,
        taxRules: inputs.retirementTaxRules,
      }),
    };
  }

  // 12. "Years without Social Security": the same comparison with Social Security left out
  // entirely (benefit = $0) — e.g. retirement years before benefits start — using the exact
  // same buildScenario as the main comparison above, just with ssBenefit = 0. This strips
  // out the Social Security phase-in and leaves plain brackets.
  const noSs = buildScenario(0);
  const withoutSocialSecurity = {
    sideAware: noSs.sideAware,
    annuity: noSs.annuity,
    comparison: {
      winner: winnerOf(noSs.annuity.roth.totalAfterTaxIncome, noSs.annuity.pretax.totalAfterTaxIncome),
      afterTaxIncomeDifference: Math.abs(
        noSs.annuity.roth.totalAfterTaxIncome - noSs.annuity.pretax.totalAfterTaxIncome,
      ),
    },
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
        pretaxDeduction,
        standardDeduction: current.standardDeduction,
        taxableIncome: current.taxableIncome,
        incomeTax: current.tax,
        // Income tax had the savings not been deducted (equal to incomeTax
        // when nothing is Pre-tax); the difference is the tax the deduction saves.
        incomeTaxWithoutPretaxDeduction: withoutContribution.tax,
        fica: fica.total,
        selfEmploymentTax: fica.selfEmployment.tax,
        selfEmploymentDeduction: fica.selfEmployment.deduction,
        selfEmploymentIncome,
        takeHome: afterTaxCurrentIncome,
        debtPayments,
        otherExpenses,
        savings,
        currentType,
      },
    },
    // effectiveRetirement = extra tax the account withdrawal causes, with each scenario's
    // taxable side account already in the stack, ÷ that withdrawal (sideAwareRates.js).
    // taxSavedNow = the tax saved today, net of any tax on investing the difference (equals
    // marginalNow when nothing exceeds the IRS limit). overallEffectiveRetirement = total tax
    // / total gross income in retirement (Pre-tax scenario).
    rates: {
      marginalNow: marginalRateNow,
      // The rate a Pre-tax contribution saves: marginalNow, or (preview option) the average over
      // the whole contribution. taxSavedNow equals it when nothing exceeds the IRS limit.
      contributionRate,
      contributionRateBasis: inputs.taxSavedAcrossContribution ? 'average' : 'marginal',
      effectiveRetirement: main.sideAware.available ? main.sideAware.effectiveRate : 0,
      taxSavedNow: main.sideAware.available ? main.sideAware.taxSavedNow : contributionRate,
      overallEffectiveRetirement: overallEffectiveRateRetirement,
      // 'pretax' | 'roth' | 'even' — the rule-of-thumb lean from the two rates above.
      lean: main.sideAware.available ? main.sideAware.lean : 'even',
    },
    // The full rates calculation (sideAwareRates.js): { available: false } when there is no
    // account withdrawal to measure (e.g. $0 saved). `rates` above mirrors its headline
    // numbers; this carries the detail the walk-through and full-tax-breakdown views need
    // (stacks, stackDetails, extraSideRate, ...).
    sideAware: { ...main.sideAware, marginalNow: marginalRateNow },
    retirementOverall: {
      totalTax: main.sideAware.available ? main.sideAware.stacks.preTaxWorld.totalTax : 0,
      grossIncome: retirementGrossIncome,
    },
    contribution,
    contributionSplit,
    limitCheck,
    grown,
    otherWithdrawals,
    lumpSum,
    annuity,
    // Section 2 verdict: which Future Contributions (account + taxable side) end up
    // with more after-tax annual income.
    comparison: {
      winner: winnerOf(annuity.roth.totalAfterTaxIncome, annuity.pretax.totalAfterTaxIncome),
      afterTaxIncomeDifference: Math.abs(
        annuity.roth.totalAfterTaxIncome - annuity.pretax.totalAfterTaxIncome,
      ),
    },
    portfolio,
    withoutSocialSecurity,
    blend,
  };
}
