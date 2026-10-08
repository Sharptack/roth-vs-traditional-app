// The child tax credit and the credit for other dependents (round 2 phase 1). Pure.
//
//   allowed     = $2,200 a child + $500 an other dependent, less $50 for each $1,000 (or part of
//                 $1,000) of MAGI over $200,000 ($400,000 joint)
//   against tax = up to the regular income tax (ordinary and capital-gains tax; not NIIT)
//   refundable  = of the children's part that the tax couldn't use: up to $1,700 a child and 15%
//                 of earned income over $2,500 (the additional child tax credit)
// Not modeled: the Social Security number rules, the three-or-more-children alternative for the
// refundable part, head of household filing status (the app files single or joint).
import { CHILD_TAX_CREDIT, CHILD_TAX_CREDIT_RULES as RULES } from '../data/childTaxCredit.js';
import { getYearData } from './yearLookup.js';

// -> { total (both parts), nonrefundable, refundable, beforePhaseOut, phaseOut }
export function childTaxCredit({ children = 0, otherDependents = 0, magi, regularTax, earnedIncome, filingStatus, year }) {
  const none = { total: 0, nonrefundable: 0, refundable: 0, beforePhaseOut: 0, phaseOut: 0 };
  if (!(children > 0) && !(otherDependents > 0)) return none;
  const { data } = getYearData(CHILD_TAX_CREDIT, year);
  const beforePhaseOut = children * data.perChild + otherDependents * data.otherDependent;
  const over = Math.max(0, magi - RULES.phaseOutStart[filingStatus]);
  const phaseOut = Math.min(beforePhaseOut, Math.max(0, Math.ceil(over / 1000 - 1e-9)) * RULES.phaseOutPer1000);
  const allowed = beforePhaseOut - phaseOut;
  const nonrefundable = Math.min(allowed, Math.max(0, regularTax));
  const childPart = Math.min(allowed, children * data.perChild);
  const unusedChildPart = Math.max(0, childPart - nonrefundable);
  const earnedLimit = RULES.refundableRate * Math.max(0, earnedIncome - RULES.refundableEarnedFloor);
  const refundable = Math.min(unusedChildPart, children * data.refundable, earnedLimit);
  return { total: nonrefundable + refundable, nonrefundable, refundable, beforePhaseOut, phaseOut };
}
