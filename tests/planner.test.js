// Round 2 phase 6 step (d): the planner's selected year (src/lib/planner.js): the room in the bracket
// and before the next IRMAA tier, a conversion's cost, its lifetime value, the suggestions.
import { describe, it, expect } from 'vitest';
import { allChangesValue, changeValue, conversionCost, plannerYear, suggestions } from '../src/lib/planner.js';
import { runProjection } from '../src/lib/projection.js';
import { sustainableSpending } from '../src/lib/projectionSummary.js';
import { conversionTotals } from '../src/lib/conversionLifetime.js';

const Y = 2026;

// A single retiree, no Social Security, return 0, no age deductions.
function retiree({ age, pretax = 0, taxable = 0, irmaa = false, endAge = age + 4, changes = [] }) {
  return {
    version: 2,
    year: Y,
    filingStatus: 'single',
    people: [{ id: 'p1', birthYear: Y - age, retirementAge: age - 1, wages: 0, selfEmploymentIncome: 0, socialSecurity: { known: true, benefit: 0, claimAge: null } }],
    accounts: [
      { id: 'a1', owner: 'p1', type: 'pretax', balance: pretax },
      { id: 'a3', owner: 'p1', type: 'taxable', balance: taxable, basisShare: 1 },
    ],
    futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 0 }] },
    spending: { debtPaymentsEnding: 0, otherExpensesEnding: 0, retirementLifestyle: 1 },
    calculators: { projection: { endAge, heirTaxRate: 0.24 } },
    assumptions: { returnRate: 0, inflationRate: 0, ageDeductions: false, medicareIrmaa: irmaa },
    plannerChanges: changes,
  };
}

describe('the selected year (2026, HAND CALC)', () => {
  // 66 (born 1960, RMDs at 75), $500,000 Pre-tax, need $30,000: W = 31,613.6364 each year (tax
  // 1,613.6364), ordinary taxable income 15,513.6364, in the 12% bracket (top 50,400).
  const h = retiree({ age: 66, pretax: 500000 });

  it('the bracket and the room left in it; the conversions that fill it and the next', () => {
    const y = plannerYear(h, 30000, 2026);
    expect(y.bracket).toMatchObject({ rate: 0.12, top: 50400, nextRate: 0.22, nextTop: 105700 });
    expect(y.bracket.room).toBeCloseTo(34886.3636, 3);
    // no Social Security to drag in, so each dollar converted is a dollar of ordinary taxable income
    expect(y.fill.bracket).toBeCloseTo(34886.3636, 2);
    expect(y.fill.nextBracket).toBeCloseTo(105700 - 15513.6364, 2);
    expect(y.irmaa).toBeNull(); // IRMAA not included in the assumptions
    // the most that can be converted: 500,000 - 31,613.6364
    expect(y.maxConversion).toBeCloseTo(468386.3636, 3);
  });

  it('a conversion’s cost: the year’s tax with it minus without it', () => {
    // 34,800 inside 12%: 4,176; no taxable account, so all of it held back from the conversion
    const c = conversionCost(h, 30000, { year: 2026, kind: 'convert', owner: 'p1', amount: 34800 });
    expect(c).toMatchObject({ converted: 34800, irmaaLater: 0 });
    expect(c.tax).toBeCloseTo(4176, 6);
    expect(c.total).toBeCloseTo(4176, 6);
    expect(c.effectiveRate).toBeCloseTo(0.12, 9);
    expect(c.heldBack).toBeCloseTo(4176, 6);
    expect(c.fromTaxable).toBeCloseTo(0, 6);
    // 90,100: 12% x 34,886.3636 + 22% x 55,213.6364 = 4,186.3636 + 12,147.0000 = 16,333.3636
    const big = conversionCost(h, 30000, { year: 2026, kind: 'convert', owner: 'p1', amount: 90100 });
    expect(big.tax).toBeCloseTo(16333.3636, 3);
    expect(big.effectiveRate).toBeCloseTo(16333.3636 / 90100, 9);
  });

  it('with a taxable account the cost is paid from it', () => {
    // $500,000 Pre-tax and $100,000 taxable (all basis): see projection.test.js for the spending split;
    // the conversion's tax comes out of taxable (no gain, so no tax on that withdrawal)
    const c = conversionCost(retiree({ age: 66, pretax: 500000, taxable: 100000 }), 30000, { year: 2026, kind: 'convert', owner: 'p1', amount: 10000 });
    expect(c.heldBack).toBeCloseTo(0, 6);
    expect(c.fromTaxable).toBeCloseTo(c.tax, 6);
  });

  it('IRMAA: the room before the next tier, and the surcharge a conversion adds two years later', () => {
    // 70 (born 1956, RMDs at 73), $1,000,000 Pre-tax, need $30,000, IRMAA on. 2027: MAGI 31,613.6364;
    // the first tier starts over 109,000 (single, 2026 amounts): room 77,386.3636, for 2029's premium.
    const hi = retiree({ age: 70, pretax: 1000000, irmaa: true });
    const y = plannerYear(hi, 30000, 2027);
    expect(y.irmaa).toMatchObject({ premiumYear: 2029, tier: 0, nextThreshold: 109000, enrolled: 1 });
    expect(y.irmaa.roomToNext).toBeCloseTo(77386.3636, 3);
    expect(y.fill.irmaa).toBeCloseTo(77386.3636, 2);
    // converting 80,000 crosses it: tier 1 in 2029, (81.20 + 14.50) x 12 = 1,148.40 for one person.
    // Tax: 12% x 34,886.3636 + 22% x 45,113.6364 = 4,186.3636 + 9,925.0000 = 14,111.3636
    const c = conversionCost(hi, 30000, { year: 2027, kind: 'convert', owner: 'p1', amount: 80000 });
    expect(c.tax).toBeCloseTo(14111.3636, 3);
    expect(c.irmaaLater).toBeCloseTo(1148.4, 6);
    expect(c.total).toBeCloseTo(14111.3636 + 1148.4, 3);
    // just under the tier: no surcharge
    expect(conversionCost(hi, 30000, { year: 2027, kind: 'convert', owner: 'p1', amount: 77300 }).irmaaLater).toBe(0);
  });
});

describe('lifetime values: each equals the difference of two full runs', () => {
  const h = retiree({ age: 66, pretax: 500000, endAge: 80 });
  const run = (household) => {
    const options = { endAge: 80, legacy: null };
    const rows = runProjection(household, { endAge: 80, need: 30000 }).rows;
    const t = conversionTotals(rows, 0.24, 0);
    return { sustainable: sustainableSpending(household, options), lifetimeTax: t.lifetimeTax, afterTaxForHeirs: t.legacyAfterTax };
  };

  it('a new conversion: against the same plan without it', () => {
    const change = { year: 2027, kind: 'convert', owner: 'p1', amount: 30000 };
    const v = changeValue(h, 30000, change);
    const a = run({ ...h, plannerChanges: [change] });
    const b = run(h);
    expect(v.difference.sustainable).toBeCloseTo(a.sustainable - b.sustainable, 6);
    expect(v.difference.lifetimeTax).toBeCloseTo(a.lifetimeTax - b.lifetimeTax, 6);
    expect(v.difference.afterTaxForHeirs).toBeCloseTo(a.afterTaxForHeirs - b.afterTaxForHeirs, 6);
    // over one conversion of 30,000 at 12% that heirs would have paid 24% on, roughly +12%
    expect(v.difference.afterTaxForHeirs).toBeGreaterThan(0);
  });

  it('a change already in the plan: against the plan without it, the others kept', () => {
    const keep = { id: 'pc1', year: 2028, kind: 'convert', owner: 'p1', amount: 20000 };
    const weigh = { id: 'pc2', year: 2027, kind: 'convert', owner: 'p1', amount: 30000 };
    const planned = { ...h, plannerChanges: [keep, weigh] };
    const v = changeValue(planned, 30000, weigh);
    const a = run(planned);
    const b = run({ ...h, plannerChanges: [keep] });
    expect(v.difference.lifetimeTax).toBeCloseTo(a.lifetimeTax - b.lifetimeTax, 6);
    expect(v.difference.afterTaxForHeirs).toBeCloseTo(a.afterTaxForHeirs - b.afterTaxForHeirs, 6);
    // all the changes together, against the base plan (none)
    const all = allChangesValue(planned, 30000);
    const base = run(h);
    expect(all.difference.lifetimeTax).toBeCloseTo(a.lifetimeTax - base.lifetimeTax, 6);
    expect(all.difference.sustainable).toBeCloseTo(a.sustainable - base.sustainable, 6);
  });
});

describe('suggestions', () => {
  it('fill the bracket, fill the next one, stay under the IRMAA tier: each rounded down to $100, with its cost', () => {
    const hi = retiree({ age: 70, pretax: 1000000, irmaa: true });
    const s = suggestions(hi, 30000, 2027, 'p1', { withValue: false });
    // the 12% top: 34,886.36 -> 34,800; the 22% top: 105,700 - 15,513.64 = 90,186.36 -> 90,100 (over the
    // IRMAA tier: its cost includes 2029's surcharge); under the tier: 77,386.36 -> 77,300
    expect(s.map((x) => [x.id, x.amount])).toEqual([
      ['bracket', 34800],
      ['irmaa', 77300],
      ['nextBracket', 90100],
    ]);
    expect(s[0].cost.tax).toBeCloseTo(4176, 6);
    expect(s[1].cost.irmaaLater).toBe(0);
    expect(s[2].cost.irmaaLater).toBeCloseTo(1148.4, 6);
  });

  it('none when the year has no Pre-tax money to convert', () => {
    expect(suggestions(retiree({ age: 70, taxable: 500000 }), 30000, 2027, 'p1', { withValue: false })).toEqual([]);
  });
});
