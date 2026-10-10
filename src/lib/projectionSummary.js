// The projection's lifetime summary and sustainable spending (roadmap phase 5). Pure; reads the
// rows runProjection returns, so the page, the lifetime comparison (phase 6) and a future
// aggregate page all use the same figures.
import { runProjection } from './projection.js';
import { STRATEGIES, strategyById } from './strategies.js';

export const DEFAULT_HEIR_TAX_RATE = 0.24;

// summarizeProjection(rows, { heirTaxRate, endAge }) -> the lifetime summary, in today's dollars:
//   totalTax / totalIncomeTax       every year's tax (income + payroll / income tax only)
//   totalIrmaa / irmaaYears         Medicare IRMAA surcharges, all years, and how many years had one
//   retirementAfterTaxIncome        after-tax income in the years anyone is retired (incl. surplus)
//   endingBalance                   by account type at the end age, and the total
//   endingAfterTax                  Pre-tax at the heirs' rate, Roth and taxable in full: heirs get a
//                                   step-up in basis on taxable accounts (IRC §1014), so the gains
//                                   aren't taxed to them (the plan doc said "taxable on its gains")
//   averageEffectiveRate            lifetime income tax ÷ lifetime gross income
//   highestTaxYear                  { year, amount } by income tax
//   moneyLastsTo                    person 1's age in the last year with no shortfall (or the end age)
//   endLabel, lastsLabel, runsOutLabel   when the last year, the last year with no shortfall, and the
//                                   first short year fall, in words (whenLabel); the last two null
//                                   when the money lasts
//   firstRetirementYear             the first year anyone is retired (null if never)
// When a projected year falls, in words: one person's age ("age 95"); for a couple the year and
// the ages of those living ("2061 (you 95, your spouse 85)", "2071 (your spouse 95)"), since after
// a death person 1's age no longer says when.
export function whenLabel(row) {
  if (row.ages.length === 1) return `age ${row.ages[0]}`;
  const who = ['you', 'your spouse'];
  const living = row.ages.map((a, i) => (row.alive?.[i] === false ? null : `${who[i]} ${a}`)).filter(Boolean);
  return `${row.year} (${living.join(', ')})`;
}

// What is left at the end after tax (phase 3 step e, decided 2026-10-10): Roth and taxable money in
// full (heirs get a step-up on taxable accounts), Pre-tax money at the heirs' rate, except what goes
// to charity, which owes no tax on it. charityShare: the share of what is left that goes to charity,
// taken from Pre-tax money first (the charity named beneficiary of the Pre-tax accounts).
//   value = total − heirTaxRate × max(0, Pre-tax − charityShare × total)
export function afterTaxEnding(end, { heirTaxRate = DEFAULT_HEIR_TAX_RATE, charityShare = 0 } = {}) {
  if (!(charityShare > 0)) return end.pretax * (1 - heirTaxRate) + end.roth + end.taxable;
  const total = end.pretax + end.roth + end.taxable;
  return total - heirTaxRate * Math.max(0, end.pretax - Math.min(1, charityShare) * total);
}

// The heirs' tax rate and the charity's share for a household (its after-tax figures read these).
export function heirsOf(household) {
  return { heirTaxRate: household.calculators?.projection?.heirTaxRate ?? DEFAULT_HEIR_TAX_RATE, charityShare: household.legacy?.charityShare ?? 0 };
}

export function summarizeProjection(rows, { heirTaxRate = DEFAULT_HEIR_TAX_RATE, charityShare = 0 } = {}) {
  const sum = (pick, list = rows) => list.reduce((s, r) => s + pick(r), 0);
  const retired = rows.filter((r) => r.working.some((w) => !w));
  const last = rows[rows.length - 1];
  const highest = rows.reduce((best, r) => (r.incomeTax > best.amount ? { year: r.year, amount: r.incomeTax } : best), {
    year: null,
    amount: -Infinity,
  });
  const firstShortIndex = rows.findIndex((r) => r.shortfall > 0);
  const firstShort = rows[firstShortIndex];
  const end = last.endBalances;
  return {
    totalTax: sum((r) => r.totalTax),
    totalIncomeTax: sum((r) => r.incomeTax),
    totalIrmaa: sum((r) => r.irmaa ?? 0),
    irmaaYears: rows.filter((r) => r.irmaa > 0).length,
    retirementAfterTaxIncome: sum((r) => r.afterTaxIncome, retired),
    endingBalance: end,
    endingAfterTax: afterTaxEnding(end, { heirTaxRate, charityShare }),
    averageEffectiveRate: sum((r) => r.grossIncome) > 0 ? sum((r) => r.incomeTax) / sum((r) => r.grossIncome) : 0,
    highestTaxYear: highest,
    moneyLastsTo: firstShort ? firstShort.ages[0] - 1 : last.ages[0],
    runsOut: Boolean(firstShort),
    endLabel: whenLabel(last),
    // (short from the first year: nothing lasts, so the label is the year before the plan)
    lastsLabel: firstShort ? (firstShortIndex > 0 ? whenLabel(rows[firstShortIndex - 1]) : 'the start') : null,
    runsOutLabel: firstShort ? whenLabel(firstShort) : null,
    firstRetirementYear: retired.length > 0 ? retired[0].year : null,
    heirTaxRate,
    charityShare,
  };
}

// The legacy goal (phase 3, decided 2026-10-09): at least `target` left at the end of the plan (the
// second death), in today's dollars, measured either as the balance itself or after tax (Pre-tax
// money at the heirs' rate, as endingAfterTax). legacy = { target, measure: 'balance' | 'afterTax',
// heirTaxRate }; absent or a target of 0 = no goal.
export function legacyValue(endBalances, { measure = 'balance', heirTaxRate = DEFAULT_HEIR_TAX_RATE, charityShare = 0 } = {}) {
  return measure === 'afterTax' ? afterTaxEnding(endBalances, { heirTaxRate, charityShare }) : endBalances.total;
}

// legacyTarget(household, goal) -> the goal in dollars: { type: 'none' | 'amount' | 'share', amount,
// share }. A share is of today's portfolio (every Existing Account).
export function legacyTarget(household, { type = 'none', amount = 0, share = 0 } = {}) {
  if (type === 'amount') return Math.max(0, amount || 0);
  if (type === 'share') return Math.max(0, share || 0) * household.accounts.reduce((s, a) => s + (a.balance || 0), 0);
  return 0;
}

// The legacy option (phase 3) the sustainable-spending search takes, from the household's goal (null = none).
export function legacyOption(household) {
  const goal = household.legacy ?? { type: 'none' };
  const target = legacyTarget(household, goal);
  if (!(target > 0)) return null;
  return { target, measure: goal.measure, ...heirsOf(household) };
}

// Whether the plan meets a spending need: no shortfall in any year, and the legacy goal (if any) left.
export function meetsPlan(household, need, { legacy, ...options } = {}) {
  const rows = runProjection(household, { ...options, need }).rows;
  if (!rows.every((r) => r.shortfall === 0)) return false;
  return !(legacy?.target > 0) || legacyValue(rows[rows.length - 1].endBalances, legacy) >= legacy.target;
}

// The highest steady after-tax spending (today's dollars) the plan supports through the end age
// with no shortfall and, with options.legacy, the legacy goal left at the end. Bisection on the
// need: a higher need can only run out sooner and leave less. Each step is a whole projection, so it
// stops at $1 of precision. 0 when even no spending can't meet the goal (meetsPlan(h, 0, …) says).
export function sustainableSpending(household, options = {}) {
  const lasts = (need) => meetsPlan(household, need, options);
  let lo = 0;
  let hi = 50000;
  while (lasts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e9) return hi;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (lasts(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Everything the projection page and its tile show, from the household and the spending need
// (the Roth calculator's retirement income number). The calculator's own inputs live under
// household.calculators.projection: { endAge, heirTaxRate }.
//   funded: sustainable spending ÷ the need (1 = exactly funded; above 1 = overfunded).
//   strategy: the chosen withdrawal strategy's id; strategies: every strategy at the actual need
//   (lifetime income tax, after-tax ending wealth, money lasts to), to compare them side by side.
export function projectionView(household, need) {
  const own = household.calculators?.projection ?? {};
  const options = { endAge: own.endAge, strategy: strategyById(own.strategy) };
  const { rows, runOutYear, endAge } = runProjection(household, { ...options, need });
  const summary = summarizeProjection(rows, heirsOf(household));
  // With a legacy goal (phase 3), sustainable spending leaves it at the end; none = as before.
  const legacy = legacyOption(household);
  const sustainable = sustainableSpending(household, { ...options, legacy });
  const strategies = STRATEGIES.map((s) => {
    const sum = summarizeProjection(runProjection(household, { endAge: own.endAge, strategy: s.strategy, need }).rows, heirsOf(household));
    const { totalIncomeTax, totalIrmaa, endingAfterTax, moneyLastsTo, lastsLabel, runsOut } = sum;
    return { id: s.id, label: s.label, totalIncomeTax, totalIrmaa, endingAfterTax, moneyLastsTo, lastsLabel, runsOut };
  });
  return {
    rows,
    runOutYear,
    endAge,
    summary,
    need,
    sustainable,
    funded: need > 0 ? sustainable / need : null,
    legacy, // the goal ({ target, measure, heirTaxRate }) or null
    strategy: STRATEGIES.find((s) => s.id === own.strategy)?.id ?? STRATEGIES[0].id,
    strategies,
  };
}
