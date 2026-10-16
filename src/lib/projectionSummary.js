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

// The calendar year the last person retires (no earlier than this year): the first year no one works.
export function lastRetirementYear(household) {
  return Math.max(household.year, ...household.people.map((p) => p.birthYear + p.retirementAge));
}

// The plan's portfolio at retirement (the default legacy goal's base, decided 2026-10-16): every
// account at the start of the year the last person retires, as the projection has it at the spending
// need (today's portfolio once everyone has retired), in today's dollars.
// overrides: the projection's savings overrides ({ contributions, taxableSavings }), for a plan with
// other savings (Pre-retirement funding's searches).
export function retirementBalance(household, need = 0, overrides = {}) {
  const own = household.calculators?.projection ?? {};
  const { rows } = runProjection(household, { need, endAge: own.endAge, strategy: strategyById(own.strategy), ...overrides });
  const row = rows.find((r) => r.year === lastRetirementYear(household)) ?? rows[0];
  return row ? row.startBalances.total : 0;
}

// legacyTarget(household, goal) -> the goal in dollars: { type: 'none' | 'amount' | 'share' |
// 'retirementShare', amount, share, retirementShare, retirementBalance }. A share is of today's
// portfolio (every Existing Account); a retirement share of the plan's portfolio at retirement
// (retirementBalance, worked out once with the spending need where the household is built; else here
// with none drawn), so the goal is a fixed dollar amount whatever a calculator varies.
export function legacyTarget(household, { type = 'none', amount = 0, share = 0, retirementShare = 0, retirementBalance: base } = {}) {
  if (type === 'amount') return Math.max(0, amount || 0);
  if (type === 'share') return Math.max(0, share || 0) * household.accounts.reduce((s, a) => s + (a.balance || 0), 0);
  if (type === 'retirementShare') return Math.max(0, retirementShare || 0) * (Number.isFinite(base) ? base : retirementBalance(household));
  return 0;
}

// The legacy option (phase 3) the sustainable-spending search takes, from the household's goal (null = none).
export function legacyOption(household) {
  const goal = household.legacy ?? { type: 'none' };
  const target = legacyTarget(household, goal);
  if (!(target > 0)) return null;
  return { target, measure: goal.measure, ...heirsOf(household) };
}

// The legacy option for a variant of the plan (other savings, another retirement age): a share of the
// portfolio at retirement is worked out afresh for it (the variant's own balance then, at the need),
// so a result found for the variant is the one the plan gets once the change is made; any other goal
// is the household's as it is.
export function legacyFor(household, need, overrides = {}) {
  const goal = household.legacy;
  if (goal?.type !== 'retirementShare') return legacyOption(household);
  return legacyOption({ ...household, legacy: { ...goal, retirementBalance: retirementBalance(household, need, overrides) } });
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
// options.tolerance (Monte Carlo's many searches, phase 8): stop within that share of the answer
// instead (0.005 = half a percent), never finer than $1; the answer is still one that lasts.
export function sustainableSpending(household, { tolerance = 0, ...options } = {}) {
  const lasts = (need) => meetsPlan(household, need, options);
  let lo = 0;
  let hi = 50000;
  while (lasts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e9) return hi;
  }
  while (hi - lo > Math.max(1, tolerance * lo)) {
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
