// Pre-retirement funding (roadmap phase 4, decided 2026-10-10): is the household on track? Two
// measures of what its assets will pay, each set against the spending need (held fixed). Pure.
//
//   1. At retirement (a threshold): in the year the last person retires, 4% of each account's
//      balance at the start of that year, plus Social Security, pensions and other income rows,
//      minus all tax and IRMAA: the projection's own year (its strategy seam), so it is the
//      household's actual plan. Compared with that year's need (a survivor's share after a death).
//   2. Through retirement: what the resources allow each year to the end of the plan with the
//      legacy goal left (sustainableSpending, phase 3), against the need.
//
// Funded level = what the assets pay ÷ the need; within ABOUT_EVEN of 1 = about even.
import { runProjection } from './projection.js';
import { legacyOption, meetsPlan, sustainableSpending } from './projectionSummary.js';
import { strategyById } from './strategies.js';
import { WITHDRAWAL_RATE } from './constants.js';

export const ABOUT_EVEN = 0.05; // to tune (roadmap)

// 'under' | 'even' | 'over', or null with no level.
export function fundedStatus(level) {
  if (level === null || !Number.isFinite(level)) return null;
  if (level < 1 - ABOUT_EVEN) return 'under';
  if (level > 1 + ABOUT_EVEN) return 'over';
  return 'even';
}

// The calendar year the last person retires (no earlier than this year): the first year no one works.
export function lastRetirementYear(household) {
  return Math.max(household.year, ...household.people.map((p) => p.birthYear + p.retirementAge));
}

// The plan's projection options (the projection calculator's end age and strategy).
function planOptions(household) {
  const own = household.calculators?.projection ?? {};
  return { endAge: own.endAge, strategy: strategyById(own.strategy) };
}

// The plan's strategy while anyone works; 4% of each account's balance once no one does.
function fourPercentOnceRetired(planStrategy) {
  return (args) => {
    if (args.working.some(Boolean)) return planStrategy(args);
    return { withdrawals: Object.fromEntries(args.accounts.map((a) => [a.id, WITHDRAWAL_RATE * a.balance])), conversions: [] };
  };
}

// Measure 1. options.savings: { contributions, taxableSavings }, the projection's overrides
// (savingsWith; absent = the plan's own).
// -> { year, ages, balances (at the start of the year), income (after tax), need (that year's),
//      funded, status }
export function atRetirement(household, need, { savings } = {}) {
  const { strategy } = planOptions(household);
  const year = lastRetirementYear(household);
  // Projected only to that year (person 1's age then).
  const endAge = year - household.people[0].birthYear;
  const { rows } = runProjection(household, { need, strategy: fourPercentOnceRetired(strategy), ...savings, endAge });
  const row = rows.find((r) => r.year === year) ?? rows[rows.length - 1];
  const funded = row.need > 0 ? row.afterTaxIncome / row.need : null;
  return {
    year: row.year,
    ages: row.ages,
    balances: row.startBalances,
    withdrawals: row.withdrawals,
    totalTax: row.totalTax,
    irmaa: row.irmaa,
    income: row.afterTaxIncome,
    need: row.need,
    funded,
    status: fundedStatus(funded),
  };
}

// Measure 2. -> { sustainable, need, funded, status }
export function throughRetirement(household, need, { savings } = {}) {
  const sustainable = sustainableSpending(household, { ...planOptions(household), legacy: legacyOption(household), ...savings });
  const funded = need > 0 ? sustainable / need : null;
  return { sustainable, need, funded, status: fundedStatus(funded) };
}

// This year's household pay: every person's W-2 and 1099 earnings.
export function householdPay(household) {
  return household.people.reduce((s, p) => s + (p.wages || 0) + (p.selfEmploymentIncome || 0), 0);
}

// The plan's savings a year: the contribution rows' total, savings to a taxable account included.
export function plannedSavings(household) {
  const fc = household.futureContributions;
  return [...fc.contributions, ...(fc.taxableSavings ?? [])].reduce((s, c) => s + (c.amount || 0), 0);
}

// The plan's savings with `extra` dollars a year more (negative = less, to none), as the projection's
// overrides { contributions, taxableSavings } (decided 2026-10-10): spread across the contribution
// rows, taxable ones included, in proportion to today's amounts (amounts over a row's IRS limit go to
// a taxable account, as always). With no savings in the rows, the extra goes to a taxable account,
// split between the people by their pay (each saves until their own retirement; with no pay, evenly).
export function savingsWith(household, extra) {
  const fc = household.futureContributions;
  const contributions = fc.contributions.map((c) => ({ owner: c.owner, amount: c.amount || 0, type: c.currentType ?? fc.currentType }));
  const taxable = (fc.taxableSavings ?? []).map((c) => ({ owner: c.owner, amount: c.amount || 0 }));
  const total = plannedSavings(household);
  if (total > 0) {
    const scale = Math.max(0, (total + extra) / total);
    const scaled = (list) => list.map((c) => ({ ...c, amount: c.amount * scale }));
    return { contributions: scaled(contributions), taxableSavings: scaled(taxable) };
  }
  if (!(extra > 0)) return { contributions, taxableSavings: taxable };
  const pay = household.people.map((p) => (p.wages || 0) + (p.selfEmploymentIncome || 0));
  const payTotal = pay.reduce((s, x) => s + x, 0);
  const share = (i) => (payTotal > 0 ? pay[i] / payTotal : 1 / pay.length);
  const added = household.people.map((p, i) => ({ owner: p.id, amount: extra * share(i) })).filter((c) => c.amount > 0);
  return { contributions, taxableSavings: added };
}

const MAX_EXTRA = 10000000; // past this, more savings is taken as no answer

// Savings needed (phase 4 step c): the extra savings a year (today's dollars, every working year)
// that brings a measure to `target` × the need, the need held fixed (decided 2026-10-10).
//   measure: 'atRetirement' (measure 1) or 'throughRetirement' (measure 2)
// -> null with no need, or {
//   reachable   false when no amount reaches the target (no working years left, say)
//   extra       the change to the plan's savings, rounded up to the dollar; negative = the target
//               is met saving less (at least −planned: saving nothing); null when not reachable
//   planned     today's savings a year (the rows' total); total = planned + extra
//   pay, extraShareOfPay, totalShareOfPay   household pay this year and the shares of it (null with no pay)
// }
// Each is a bisection on the extra: more savings can only leave more. Measure 1 compares the 4%
// income at retirement; measure 2 asks whether the plan meets target × the need with the legacy
// goal left (meetsPlan): one projection a step, not a sustainable-spending search.
export function savingsNeeded(household, need, { measure = 'atRetirement', target = 1 } = {}) {
  if (!(need > 0)) return null;
  const options = planOptions(household);
  const legacy = legacyOption(household);
  const meets =
    measure === 'atRetirement'
      ? (extra) => atRetirement(household, need, { savings: savingsWith(household, extra) }).funded >= target
      : (extra) => meetsPlan(household, target * need, { ...options, legacy, ...savingsWith(household, extra) });
  const planned = plannedSavings(household);
  const pay = householdPay(household);
  const result = (extra) => ({
    reachable: extra !== null,
    extra,
    planned,
    total: extra === null ? null : planned + extra,
    pay,
    extraShareOfPay: extra !== null && pay > 0 ? extra / pay : null,
    totalShareOfPay: extra !== null && pay > 0 ? (planned + extra) / pay : null,
  });
  let lo = -planned;
  if (meets(lo)) return result(-planned);
  let hi = Math.max(10000, planned);
  while (!meets(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > MAX_EXTRA) return result(null);
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return result(Math.ceil(hi));
}
