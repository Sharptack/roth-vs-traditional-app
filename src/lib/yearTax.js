// The single-year tax engine (roadmap phase 2): one federal tax year for a household, from every
// income source at once. Pure. It MERGES the existing, hand-verified pieces rather than
// rewriting them: payroll tax (ficaTax.js), Social Security taxability (socialSecurityTax.js),
// the ordinary brackets (taxCalculations.js), capital-gains stacking and NIIT
// (capitalGainsTax.js). Where the inputs overlap, it agrees to the cent with
// calculateRetirementTax and with calculateTaxFromGross + calculateEmploymentTaxes (tested).
//
// Income is grouped by how it is TAXED, not where it comes from:
//   people[].wages, people[].selfEmploymentIncome  W-2 and net 1099 earnings, per person (payroll tax)
//   income.ordinaryIncome            ordinary rates; no payroll tax; not NIIT: Pre-tax withdrawals
//                                    (incl. RMDs), Roth conversions, pensions
//   income.investmentOrdinaryIncome  ordinary rates + NIIT: interest, non-qualified dividends,
//                                    short-term gains
//   income.preferentialIncome        capital-gains rates + NIIT: long-term gains, qualified
//                                    dividends (a taxable-account withdrawal passes its gain part)
//   income.socialSecurity            total benefits; its own taxability formula
//   pretaxDeferrals                  401(k)/IRA contributions deducted this year (not from payroll tax)
//
// Options (defaults reproduce today's rules exactly):
//   thresholdScale  multiplies the fixed-dollar thresholds the law never indexes (Social Security
//                   taxability, NIIT, Additional Medicare). In today's dollars they shrink each year:
//                   the projection passes 1 / (1 + inflation)^years.
//   rateShift       added to every ordinary bracket rate (a tax-law what-if, e.g. 0.03 = 3 points
//                   higher). Capital-gains rates are not shifted.
//   calendarYear    the calendar year being taxed, when `year` is the law's data year instead (a
//                   future year taxed under today's law); only the senior deduction's end date uses it.
//   itemizedDeductions  the year's itemized deductions, a total (mortgage interest, state and local
//                   taxes, charitable gifts...). Taken instead of the standard deduction when larger;
//                   an itemizer loses the extra standard deduction at 65 but keeps the senior
//                   deduction. Default 0: the standard deduction, as before.
//   qbi             true: take the qualified business income deduction on 1099 earnings (lib/qbi.js,
//                   the basic rule). Off by default, so the current calculator's numbers don't change.
//
// Age deductions: for each person whose `age` is given and is 65 or older, the additional standard
// deduction and (2025-2028) the senior deduction (data/ageDeductions.js). Callers that pass no
// ages get today's standard deduction only, so every existing calculation is unchanged.
//
// Simplifications: itemized deductions only as one total (itemizedDeductions), no AMT, credits or
// state tax; the QBI
// deduction only with the qbi option, basic rule. People with an age and no earnings (retirees) are fine: they owe no payroll tax.
import { calculateHouseholdEmploymentTaxes } from './ficaTax.js';
import { calculateTaxableSocialSecurity } from './socialSecurityTax.js';
import { calculateTax, getBrackets, getMarginalRate, getStandardDeduction } from './taxCalculations.js';
import { calculateCapitalGainsTax, calculateNiit } from './capitalGainsTax.js';
import { CAPITAL_GAINS_BRACKETS } from '../data/capitalGainsBrackets.js';
import { AGE_DEDUCTIONS } from '../data/ageDeductions.js';
import { getYearData } from './yearLookup.js';
import { qbiDeduction } from './qbi.js';

// The 65+ additional standard deduction and the senior deduction for these people, at this MAGI.
// calendarYear: the year being taxed, when it differs from `year` (the law's data year). The
//   Roth comparison taxes a FUTURE retirement year under today's law in today's dollars, so the
//   senior deduction (law for 2025-2028 only) is checked against the real calendar year.
// thresholdScale: the senior deduction's $6,000 and its phase-out start are fixed dollar amounts,
//   so they shrink in today's dollars like the other fixed thresholds; the 65+ add-on is indexed.
export function ageDeductions(people, filingStatus, year, magi, { calendarYear = year, thresholdScale = 1 } = {}) {
  const seniors = people.filter((p) => p.age >= 65).length;
  if (seniors === 0) return { additional65: 0, senior: 0, seniors };
  const { data } = getYearData(AGE_DEDUCTIONS, year);
  const additional65 = seniors * data.additional65[filingStatus];
  const s = data.senior;
  const perPerson =
    calendarYear <= s.lastYear
      ? Math.max(0, s.amount * thresholdScale - s.phaseOutRate * Math.max(0, magi - s.phaseOutStart[filingStatus] * thresholdScale))
      : 0;
  return { additional65, senior: seniors * perPerson, seniors };
}

// The probe for marginal rates: the extra tax from $100 more of one source, ÷ 100.
export const MARGINAL_PROBE = 100;

const NO_PAYROLL = {
  w2: { socialSecurity: 0, medicare: 0 },
  selfEmployment: { netEarnings: 0, socialSecurity: 0, medicare: 0, tax: 0, deduction: 0 },
  additionalMedicare: 0,
  total: 0,
  people: [],
};

// The year's tax WITHOUT the per-source marginal rates and bracket room (calculateYearTax adds
// those with six more runs). For solvers that only need the totals, e.g. the projection.
export function calculateYearTaxTotals(params) {
  return core(params);
}

function core({ filingStatus, year, people = [], pretaxDeferrals = 0, income = {}, thresholdScale = 1, rateShift = 0, calendarYear = year, qbi = false, itemizedDeductions = 0 }) {
  const ordinaryIncome = income.ordinaryIncome ?? 0;
  const investmentOrdinaryIncome = income.investmentOrdinaryIncome ?? 0;
  const preferentialIncome = Math.max(0, income.preferentialIncome ?? 0);
  const socialSecurity = income.socialSecurity ?? 0;

  const payroll =
    people.length > 0
      ? calculateHouseholdEmploymentTaxes({
          earners: people.map((p) => ({ wages: p.wages ?? 0, selfEmploymentIncome: p.selfEmploymentIncome ?? 0 })),
          filingStatus,
          year,
          thresholdScale,
        })
      : NO_PAYROLL;
  const wages = people.reduce((acc, p) => acc + (p.wages ?? 0), 0);
  const selfEmploymentIncome = people.reduce((acc, p) => acc + (p.selfEmploymentIncome ?? 0), 0);
  const earned = wages + selfEmploymentIncome;
  // Above-the-line: half of self-employment tax, and this year's Pre-tax deferrals.
  const adjustments = payroll.selfEmployment.deduction + pretaxDeferrals;

  // Social Security combined income uses everything else in AGI (IRS Pub. 915).
  const incomeBeforeSocialSecurity = earned - adjustments + ordinaryIncome + investmentOrdinaryIncome + preferentialIncome;
  const taxableSocialSecurity = calculateTaxableSocialSecurity(
    incomeBeforeSocialSecurity,
    socialSecurity,
    filingStatus,
    year,
    thresholdScale,
  );
  const ordinaryGross = earned - adjustments + ordinaryIncome + investmentOrdinaryIncome + taxableSocialSecurity;
  const agi = ordinaryGross + preferentialIncome;
  const baseStandardDeduction = getStandardDeduction(filingStatus, year);
  const age = ageDeductions(people, filingStatus, year, agi, { calendarYear, thresholdScale });
  // Everything subtracted from AGI; "standardDeduction" below is this total. Itemizing replaces the
  // standard deduction and its 65+ extra when larger; the senior deduction applies either way.
  const itemized = Math.max(0, itemizedDeductions);
  const itemizing = itemized > baseStandardDeduction + age.additional65;
  const additional65 = itemizing ? 0 : age.additional65;
  const standardDeduction = (itemizing ? itemized : baseStandardDeduction) + additional65 + age.senior;
  // QBI: 1099 earnings less the deductible half of self-employment tax; the deduction comes off
  // taxable income (not AGI), from the ordinary part first, so gains still stack on top.
  const qualifiedBusinessIncome = qbi ? Math.max(0, selfEmploymentIncome - payroll.selfEmployment.deduction) : 0;
  const qbiResult = qbiDeduction({
    qbi: qualifiedBusinessIncome,
    taxableIncome: Math.max(0, agi - standardDeduction),
    netCapitalGain: preferentialIncome,
    filingStatus,
    year,
  });
  const deductions = standardDeduction + qbiResult.deduction;
  const ordinaryTaxableIncome = Math.max(0, ordinaryGross - deductions);
  const taxableIncome = Math.max(0, agi - deductions);

  const ordinaryTax = calculateTax(ordinaryTaxableIncome, filingStatus, year, rateShift);
  const capitalGainsTax = calculateCapitalGainsTax(ordinaryGross, preferentialIncome, deductions, filingStatus, year);
  const netInvestmentIncome = Math.max(0, investmentOrdinaryIncome) + preferentialIncome;
  const niit = calculateNiit(agi, netInvestmentIncome, filingStatus, year, thresholdScale);
  const incomeTax = ordinaryTax + capitalGainsTax + niit;
  const payrollTax = payroll.total;
  const totalTax = incomeTax + payrollTax;
  const grossIncome = earned + ordinaryIncome + investmentOrdinaryIncome + preferentialIncome + socialSecurity;

  return {
    lines: {
      grossIncome,
      wages,
      selfEmploymentIncome,
      ordinaryIncome,
      investmentOrdinaryIncome,
      preferentialIncome,
      socialSecurity,
      taxableSocialSecurity,
      // other income plus half of the benefits: what sets how much of them is taxable (Pub. 915)
      provisionalIncome: incomeBeforeSocialSecurity + socialSecurity / 2,
      adjustments,
      selfEmploymentTaxDeduction: payroll.selfEmployment.deduction,
      pretaxDeferrals,
      agi,
      magi: agi, // for NIIT and the senior deduction, MAGI = AGI here (no foreign-income exclusion modeled)
      baseStandardDeduction,
      additional65Deduction: additional65,
      itemizedDeductions: itemized,
      itemizing,
      seniorDeduction: age.senior,
      standardDeduction, // the total: the standard deduction (or the itemized total), 65+ extra, senior
      qualifiedBusinessIncome,
      qbiDeduction: qbiResult.deduction,
      deductions, // the standard deduction total plus the QBI deduction
      ordinaryGross, // ordinary income before the standard deduction
      ordinaryTaxableIncome,
      taxableIncome,
      netInvestmentIncome,
    },
    ordinaryTax,
    capitalGainsTax,
    niit,
    incomeTax,
    payroll,
    payrollTax,
    totalTax,
    effectiveRate: grossIncome > 0 ? incomeTax / grossIncome : 0,
    effectiveRateWithPayroll: grossIncome > 0 ? totalTax / grossIncome : 0,
    // The rate of the ordinary bracket the next taxable dollar falls in (0 while under the
    // standard deduction). The same figure calculateTaxFromGross reports as marginalRate.
    ordinaryBracketRate: getMarginalRate(ordinaryGross - deductions, filingStatus, year, rateShift),
  };
}

// Dollars left before the next ordinary bracket and the next capital-gains threshold.
//  ordinary: from the top of ordinary taxable income (while under the standard deduction, the
//            room is what's left of the deduction, at 0%).
//  capitalGains: from the top of the whole stack (ordinary + gains), where the next dollar of
//            gains would land.
function bracketRoom(r, filingStatus, year, rateShift) {
  const { ordinaryGross, deductions, ordinaryTaxableIncome, taxableIncome } = r.lines;
  let ordinary;
  if (ordinaryGross < deductions) {
    ordinary = { rate: 0, room: deductions - ordinaryGross, nextRate: getBrackets(filingStatus, year)[0].rate + rateShift };
  } else {
    const brackets = getBrackets(filingStatus, year);
    const i = brackets.findIndex((b) => ordinaryTaxableIncome < b.upTo);
    ordinary = {
      rate: brackets[i].rate + rateShift,
      room: brackets[i].upTo - ordinaryTaxableIncome,
      nextRate: i + 1 < brackets.length ? brackets[i + 1].rate + rateShift : null,
    };
  }
  const cg = getYearData(CAPITAL_GAINS_BRACKETS, year).data[filingStatus];
  const j = cg.findIndex((b) => taxableIncome < b.upTo);
  const capitalGains = {
    rate: cg[j].rate,
    room: cg[j].upTo - taxableIncome,
    nextRate: j + 1 < cg.length ? cg[j + 1].rate : null,
  };
  return { ordinary, capitalGains };
}

// The sources a marginal rate is reported for, and how $100 more of each is added.
const SOURCES = {
  wages: (p, d) => ({ ...p, people: addToFirstPerson(p.people, 'wages', d) }),
  selfEmploymentIncome: (p, d) => ({ ...p, people: addToFirstPerson(p.people, 'selfEmploymentIncome', d) }),
  ordinaryIncome: (p, d) => ({ ...p, income: { ...p.income, ordinaryIncome: (p.income?.ordinaryIncome ?? 0) + d } }),
  investmentOrdinaryIncome: (p, d) => ({
    ...p,
    income: { ...p.income, investmentOrdinaryIncome: (p.income?.investmentOrdinaryIncome ?? 0) + d },
  }),
  preferentialIncome: (p, d) => ({ ...p, income: { ...p.income, preferentialIncome: (p.income?.preferentialIncome ?? 0) + d } }),
  socialSecurity: (p, d) => ({ ...p, income: { ...p.income, socialSecurity: (p.income?.socialSecurity ?? 0) + d } }),
};

function addToFirstPerson(people = [], key, d) {
  const list = people.length > 0 ? people : [{ wages: 0, selfEmploymentIncome: 0 }];
  return list.map((p, i) => (i === 0 ? { ...p, [key]: (p[key] ?? 0) + d } : p));
}

// -> { lines, ordinaryTax, capitalGainsTax, niit, incomeTax, payroll, payrollTax, totalTax,
//      effectiveRate (income tax ÷ gross income), effectiveRateWithPayroll, ordinaryBracketRate,
//      marginalRates: { [source]: { incomeTax, total } }, bracketRoom: { ordinary, capitalGains } }
// marginalRates: the extra tax from $100 more of that source, everything else unchanged, ÷ 100.
// `incomeTax` leaves payroll tax out; `total` includes it (only wages and 1099 income pay it).
export function calculateYearTax(params) {
  const r = core(params);
  const marginalRates = {};
  for (const [source, add] of Object.entries(SOURCES)) {
    const more = core(add(params, MARGINAL_PROBE));
    marginalRates[source] = {
      incomeTax: (more.incomeTax - r.incomeTax) / MARGINAL_PROBE,
      total: (more.totalTax - r.totalTax) / MARGINAL_PROBE,
    };
  }
  return {
    ...r,
    marginalRates,
    bracketRoom: bracketRoom(r, params.filingStatus, params.year, params.rateShift ?? 0),
  };
}
