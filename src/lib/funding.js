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
import { lastRetirementYear, legacyFor, meetsPlan, sustainableSpending } from './projectionSummary.js';
import { strategyById } from './strategies.js';
import { WITHDRAWAL_RATE } from './constants.js';
import { everyoneRetired } from './spendingNeed.js';
import { addRow } from './householdValues.js';

export const ABOUT_EVEN = 0.05; // to tune (roadmap)

// 'under' | 'even' | 'over', or null with no level.
export function fundedStatus(level) {
  if (level === null || !Number.isFinite(level)) return null;
  if (level < 1 - ABOUT_EVEN) return 'under';
  if (level > 1 + ABOUT_EVEN) return 'over';
  return 'even';
}

// The calendar year the last person retires: projectionSummary.js's (the legacy goal's base reads it too).
export { lastRetirementYear };

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
// -> { year, ages, balances (at the start of the year), withdrawals, totalTax, irmaa, income (after
//      tax), otherIncome (Social Security, pensions and other income rows: income + tax + IRMAA −
//      the withdrawals), need (that year's), funded, status }
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
    otherIncome: row.afterTaxIncome + row.totalTax + (row.irmaa ?? 0) - row.withdrawals.total,
    need: row.need,
    funded,
    status: fundedStatus(funded),
  };
}

// Measure 2. -> { sustainable, need, funded, status }
export function throughRetirement(household, need, { savings } = {}) {
  // (a goal that is a share of the portfolio at retirement: this plan's, with these savings)
  const sustainable = sustainableSpending(household, { ...planOptions(household), legacy: legacyFor(household, need, savings), ...savings });
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
  // (the legacy goal with each amount's savings: a share of the portfolio at retirement moves with them)
  const meets =
    measure === 'atRetirement'
      ? (extra) => atRetirement(household, need, { savings: savingsWith(household, extra) }).funded >= target
      : (extra) => {
          const savings = savingsWith(household, extra);
          return meetsPlan(household, target * need, { ...options, legacy: legacyFor(household, need, savings), ...savings });
        };
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

// Everything the Pre-retirement funding page shows (phase 4 step d), from the household and the
// spending need. Through retirement leads (decided 2026-10-10); the 4% at retirement beside it.
// -> { retired: true } when everyone is retired already (the page sends them to Retirement
//    spending), or { retired: false, need, target, through, at, savings: { through, at } }
//    (savingsNeeded for each measure, to the target).
export function fundingView(household, need) {
  if (everyoneRetired(household)) return { retired: true };
  const target = household.calculators?.funding?.target ?? 1;
  return {
    retired: false,
    need,
    target,
    through: throughRetirement(household, need),
    at: atRetirement(household, need),
    savings: {
      through: savingsNeeded(household, need, { measure: 'throughRetirement', target }),
      at: savingsNeeded(household, need, { measure: 'atRetirement', target }),
    },
  };
}

// "Use in the plan" for a savings figure (decided 2026-10-10): null when there is nothing to
// change (out of reach, or within $1 of the plan), else { extra, total }.
export function savingsChoice(solved) {
  if (!solved?.reachable || Math.abs(solved.extra) < 1) return null;
  return { extra: solved.extra, total: solved.total };
}

// The values with the plan's savings changed by `extra` a year, as savingsWith spreads it: each
// contribution row of a person still working scaled in proportion, rounded up to the dollar (so the
// plan lands at or above the target); with no savings in the rows, a taxable row for each person
// with pay, split by pay. The household (toHouseholdV2 of these values) says who is working.
export function applySavingsChoice(values, household, extra) {
  const working = new Set(household.people.filter((p) => household.year - p.birthYear < p.retirementAge).map((p) => p.id));
  const counts = (r) => working.has(r.owner);
  const amount = (r) => Number(r.amount) || 0;
  const planned = values.contributions.filter(counts).reduce((s, r) => s + amount(r), 0);
  if (planned > 0) {
    const scale = Math.max(0, (planned + extra) / planned);
    return { ...values, contributions: values.contributions.map((r) => (counts(r) ? { ...r, amount: String(Math.ceil(amount(r) * scale - 1e-9)) } : r)) };
  }
  if (!(extra > 0)) return values;
  const people = household.people.filter((p) => working.has(p.id));
  const pay = people.map((p) => (p.wages || 0) + (p.selfEmploymentIncome || 0));
  const payTotal = pay.reduce((s, x) => s + x, 0);
  let next = values;
  people.forEach((p, i) => {
    const share = payTotal > 0 ? pay[i] / payTotal : 1 / people.length;
    if (share > 0) next = addRow(next, 'contributions', { owner: p.id, tax: 'taxable', amount: String(Math.ceil(extra * share - 1e-9)) });
  });
  return next;
}

// Retirement age (phase 4 step e, decided 2026-10-10): each person's age moved on its own, the
// other's held; their earnings, contributions and a Social Security claim "at retirement" follow it
// (the projection reads the age each year). The table shows both funded levels at each age; the
// savings needed are worked out only for the age picked (a full table costs ~1.7 s a person).
export const AGE_SPAN = 5;

// The household with one person's retirement age changed.
export function withRetirementAge(household, personId, age) {
  return { ...household, people: household.people.map((p) => (p.id === personId ? { ...p, retirementAge: age } : p)) };
}

// -> one entry per person still working: { personId, ageNow, planned, rows: [{ age, through, at }] }
//    (through / at: { funded, status }), ages from 5 before the planned age (but after this year) to 5 after.
export function retirementAgeTable(household, need) {
  return household.people
    .map((p) => ({ p, ageNow: household.year - p.birthYear }))
    .filter(({ p, ageNow }) => p.retirementAge > ageNow)
    .map(({ p, ageNow }) => {
      const rows = [];
      for (let age = Math.max(ageNow + 1, p.retirementAge - AGE_SPAN); age <= p.retirementAge + AGE_SPAN; age++) {
        const h = withRetirementAge(household, p.id, age);
        const { funded: tf, status: ts } = throughRetirement(h, need);
        const { funded: af, status: as } = atRetirement(h, need);
        rows.push({ age, through: { funded: tf, status: ts }, at: { funded: af, status: as } });
      }
      return { personId: p.id, ageNow, planned: p.retirementAge, rows };
    });
}

// The picked age in full: the funded levels and the savings needed to the target for both measures.
export function retirementAgeDetail(household, need, personId, age) {
  const h = withRetirementAge(household, personId, age);
  const target = household.calculators?.funding?.target ?? 1;
  return {
    personId,
    age,
    through: throughRetirement(h, need),
    at: atRetirement(h, need),
    savings: {
      through: savingsNeeded(h, need, { measure: 'throughRetirement', target }),
      at: savingsNeeded(h, need, { measure: 'atRetirement', target }),
    },
  };
}

// "Use in the plan" for a retirement age: the values with that person's retirement age set.
export function applyRetirementAge(values, personId, age) {
  return { ...values, people: values.people.map((p) => (p.id === personId ? { ...p, retirementAge: String(age) } : p)) };
}

// Overfunded (phase 4 step f): the earliest retirement age, one person's moved on its own, at which
// a measure still reaches `target` × the need. A bisection on whole ages from the year after this
// one to the planned age (funded rises with a later retirement). -> the age, or null when even the
// planned age falls short.
export function earliestRetirement(household, need, personId, { measure = 'throughRetirement', target = 1 } = {}) {
  const p = household.people.find((x) => x.id === personId);
  const ageNow = household.year - p.birthYear;
  if (!(need > 0) || !(p.retirementAge > ageNow)) return null;
  const run = measure === 'atRetirement' ? atRetirement : throughRetirement;
  const meets = (age) => run(withRetirementAge(household, personId, age), need).funded >= target;
  let hi = p.retirementAge;
  if (!meets(hi)) return null;
  let lo = ageNow; // retiring now isn't offered: the answer is above it
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// What an overfunded plan has to spare (step f): null unless a measure is over, else {
//   moreToSpend    through retirement: what the resources allow above the need, a year
//   lessToSave     { through, at }: how much less could be saved a year and still reach the target
//                  (from savingsNeeded; 0 when nothing can be cut)
//   earliest       per person still working: { personId, planned, through, at } (ages, or null)
// }
export function overfundedView(household, view) {
  if (view.retired || !(view.through.status === 'over' || view.at.status === 'over')) return null;
  const { need, target } = view;
  const less = (s) => (s.reachable && s.extra < 0 ? -s.extra : 0);
  return {
    couple: household.people.length > 1,
    moreToSpend: Math.max(0, view.through.sustainable - need),
    lessToSave: { through: less(view.savings.through), at: less(view.savings.at) },
    earliest: household.people
      .filter((p) => p.retirementAge > household.year - p.birthYear)
      .map((p) => ({
        personId: p.id,
        planned: p.retirementAge,
        through: earliestRetirement(household, need, p.id, { measure: 'throughRetirement', target }),
        at: earliestRetirement(household, need, p.id, { measure: 'atRetirement', target }),
      })),
  };
}
