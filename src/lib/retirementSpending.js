// Retirement spending (roadmap phase 3 step c): what the household's resources allow it to spend
// each year, with the legacy goal left at the second death, against the spending need. A plan
// evaluator; its "Use in the plan" writes the figure back as the budget (decided 2026-10-10). Pure.
import { legacyOption, legacyValue, meetsPlan, summarizeProjection, sustainableSpending, whenLabel } from './projectionSummary.js';
import { runProjection } from './projection.js';
import { strategyById } from './strategies.js';
import { budgetNeed, everyoneRetired } from './spendingNeed.js';

// retirementSpendingView(household, need) -> {
//   need                 the spending need (spendingNeed.js)
//   sustainable          the most per year after tax with no shortfall and the goal left
//   difference           sustainable − need (positive = room to spend more)
//   legacy               the goal ({ type, target, measure, heirTaxRate }; target 0 = none)
//   reachable            false when even no spending leaves the goal (sustainable is then 0)
//   withoutGoal          sustainable spending with no goal (the goal's cost = withoutGoal − sustainable)
//   endingValue          what is left at the end at that spending, by the goal's measure
//   endLabel             when the plan ends, in words ("age 95", "2071 (your spouse 95)")
// }
export function retirementSpendingView(household, need) {
  const own = household.calculators?.projection ?? {};
  const options = { endAge: own.endAge, strategy: strategyById(own.strategy) };
  const legacy = legacyOption(household);
  const measure = { measure: household.legacy?.measure ?? 'balance', heirTaxRate: own.heirTaxRate };
  const sustainable = sustainableSpending(household, { ...options, legacy });
  const withoutGoal = legacy ? sustainableSpending(household, options) : sustainable;
  const rows = runProjection(household, { ...options, need: sustainable }).rows;
  return {
    need,
    sustainable,
    difference: sustainable - need,
    legacy: { type: legacy ? household.legacy.type : 'none', target: legacy?.target ?? 0, ...measure },
    reachable: legacy ? meetsPlan(household, 0, { ...options, legacy }) : true,
    withoutGoal,
    endingValue: legacyValue(rows[rows.length - 1].endBalances, measure),
    endLabel: whenLabel(rows[rows.length - 1]),
    summary: summarizeProjection(rows, { heirTaxRate: own.heirTaxRate }),
  };
}

// A round step for the chart's goals: 1, 2, 2.5 or 5 times a power of ten, at or above `raw`.
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
}

// The trade-off (phase 3 step d): spending against the legacy goal, by the goal's measure.
// legacyTradeoff(household, need) -> null when nothing can be left, or {
//   points        [{ goal, spending }]: round steps from no goal to just past the range's end (what
//                 is left spending the need, or the goal if larger; without either, a quarter of
//                 the most), with the household's own goal among them
//   atNeed        what is left at the end spending the need (null when the need runs out)
//   maxLegacy     the most the plan can leave (at no spending)
//   per100k       what each $100,000 more for heirs costs a year, at the household's goal (from the
//                 last two points when $100,000 more is out of reach)
//   goal          the household's goal (0 = none)
// }
export function legacyTradeoff(household, need) {
  const own = household.calculators?.projection ?? {};
  const options = { endAge: own.endAge, strategy: strategyById(own.strategy) };
  const measure = { measure: household.legacy?.measure ?? 'balance', heirTaxRate: own.heirTaxRate };
  const endValue = (n) => {
    const rows = runProjection(household, { ...options, need: n }).rows;
    return rows.every((r) => r.shortfall === 0) ? legacyValue(rows[rows.length - 1].endBalances, measure) : null;
  };
  const maxLegacy = endValue(0);
  if (!(maxLegacy > 0)) return null;
  const at = (goal) => sustainableSpending(household, { ...options, legacy: goal > 0 ? { target: goal, ...measure } : null });
  const goal = legacyOption(household)?.target ?? 0;
  const atNeed = need > 0 ? endValue(need) : null;
  const end = Math.min(maxLegacy, Math.max(atNeed ?? 0, goal) || maxLegacy / 4);
  const step = niceStep(end / 5);
  const grid = [];
  for (let g = 0; g < maxLegacy; g += step) {
    grid.push(g);
    if (g >= end) break;
  }
  const goals = [...new Set([...grid, ...(goal < maxLegacy ? [goal] : [])])].sort((a, b) => a - b);
  const points = goals.map((g) => ({ goal: g, spending: at(g) }));
  const mine = points.find((p) => p.goal === goal);
  let per100k;
  if (mine && goal + 100000 < maxLegacy) per100k = mine.spending - at(goal + 100000);
  else {
    const [a, b] = points.slice(-2);
    per100k = b && b.goal > a.goal ? ((a.spending - b.spending) / (b.goal - a.goal)) * 100000 : null;
  }
  return { points, atNeed, maxLegacy, per100k, goal };
}

// "Use in the plan" (decided 2026-10-10): the budget that gives `spending` as the retirement need.
// The budget is today's spending, so for a household still working it is worked back through the
// costs that end and the lifestyle: spending ÷ lifestyle + the costs; already retired, as is.
// Rounded down to the dollar, so the plan's need lands at or just under `spending`.
export function budgetFor(household, spending) {
  const s = household.spending;
  if (everyoneRetired(household)) return Math.floor(spending);
  const lifestyle = s.retirementLifestyle > 0 ? s.retirementLifestyle : 1;
  return Math.floor(spending / lifestyle + s.debtPaymentsEnding + s.otherExpensesEnding);
}

// -> null (nothing to change: the plan already spends within $1 of it), or
//    { spending, baseline, need }: need = the retirement need the new budget gives.
export function spendingChoice(household, view) {
  if (!view || !(view.sustainable > 0)) return null;
  const baseline = budgetFor(household, view.sustainable);
  const { target } = budgetNeed({ ...household.spending, baselineExpenses: baseline }, { retired: everyoneRetired(household) });
  if (Math.abs(target - view.need) < 1) return null;
  return { spending: view.sustainable, baseline, need: target };
}

// The values with retirement spending set to the budget.
export function applySpendingChoice(values, choice) {
  return { ...values, spending: { ...values.spending, method: 'budget', baseline: String(choice.baseline) } };
}
