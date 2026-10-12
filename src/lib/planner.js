// The year-by-year planner (roadmap phase 6, decided 2026-10-12). Pure. The changes themselves are
// household.plannerChanges (runProjection's yearChanges); this module describes and weighs them.
import { formatCurrency } from './format.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const yearsOf = (list) => [...new Set(list.map((c) => c.year))].sort((a, b) => a - b).join(', ');

// One line for the pages that run the plan (decided 2026-10-12: every evaluator notes the changes),
// or null with none: "The plan includes 2 Roth conversions (2030, 2031) and 1 contribution change
// (2028) from the year-by-year planner." With conversionsOnly (the Roth page's comparison, which sets
// the contributions itself) the contribution changes are said not to count there.
export function plannerChangesNote(changes = [], { conversionsOnly = false } = {}) {
  const conversions = changes.filter((c) => c.kind === 'convert');
  const contributions = changes.filter((c) => c.kind === 'contribution');
  if (conversions.length + contributions.length === 0) return null;
  const parts = [];
  if (conversions.length > 0) {
    const total = conversions.reduce((s, c) => s + c.amount, 0);
    parts.push(`${plural(conversions.length, 'Roth conversion', 'Roth conversions')} (${yearsOf(conversions)}; ${formatCurrency(total)} in all)`);
  }
  if (contributions.length > 0) parts.push(`${plural(contributions.length, 'contribution change', 'contribution changes')} (${yearsOf(contributions)})`);
  let text = `The plan includes ${parts.join(' and ')} from the year-by-year planner.`;
  if (conversionsOnly && contributions.length > 0) text += ' This comparison sets the contributions itself, so only the conversions count here.';
  return text;
}
