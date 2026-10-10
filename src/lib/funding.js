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
import { legacyOption, sustainableSpending } from './projectionSummary.js';
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

// Measure 1. options.contributions: the projection's override (savings needed, phase 4 step c).
// -> { year, ages, balances (at the start of the year), income (after tax), need (that year's),
//      funded, status }
export function atRetirement(household, need, { contributions } = {}) {
  const { strategy } = planOptions(household);
  const year = lastRetirementYear(household);
  // Projected only to that year (person 1's age then).
  const endAge = year - household.people[0].birthYear;
  const { rows } = runProjection(household, { need, strategy: fourPercentOnceRetired(strategy), contributions, endAge });
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
export function throughRetirement(household, need, { contributions } = {}) {
  const sustainable = sustainableSpending(household, { ...planOptions(household), legacy: legacyOption(household), contributions });
  const funded = need > 0 ? sustainable / need : null;
  return { sustainable, need, funded, status: fundedStatus(funded) };
}
