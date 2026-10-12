// Round 2 phase 6 step (c): the planner's changes saved with the household (values.plannerChanges):
// cleaned like every other value, carried by saves and share links, and read by every calculator
// through the household (toHouseholdV2 -> household.plannerChanges -> runProjection).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOUSEHOLD_VALUES,
  BLANK_HOUSEHOLD_VALUES,
  addPlannerChange,
  addRow,
  cleanHouseholdValues,
  removePlannerChange,
  removeRow,
} from '../src/lib/householdValues.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { householdLinkSearchV2, householdValuesV2FromSearch } from '../src/lib/householdLink.js';
import { sameSavedHouseholdV2, valuesV2FromCase, caseFromValuesV2 } from '../src/lib/savedHousehold.js';
import { runProjection } from '../src/lib/projection.js';

const Y = 2026;
const contribution = (id, amount) => ({ id, owner: 'p1', tax: 'pretax', account: '401k', amount, employer: 'none', matchRate: '1', matchUpTo: '0.04', employerAmount: '' });

describe('values.plannerChanges', () => {
  it('none by default, and none in a new household', () => {
    expect(DEFAULT_HOUSEHOLD_VALUES.plannerChanges).toEqual([]);
    expect(BLANK_HOUSEHOLD_VALUES.plannerChanges).toEqual([]);
    // a save from before phase 6 opens with none
    const { plannerChanges, ...older } = DEFAULT_HOUSEHOLD_VALUES;
    expect(plannerChanges).toEqual([]);
    expect(cleanHouseholdValues(older, Y).plannerChanges).toEqual([]);
  });

  it('adding and removing: each change gets an id', () => {
    let v = addPlannerChange(DEFAULT_HOUSEHOLD_VALUES, { year: 2030, kind: 'convert', owner: 'p1', amount: 40000 });
    v = addPlannerChange(v, { year: 2031, kind: 'contribution', row: 'c1', amount: 0, scope: 'onward' });
    expect(v.plannerChanges.map((c) => c.id)).toEqual(['pc1', 'pc2']);
    v = removePlannerChange(v, 'pc1');
    expect(v.plannerChanges).toEqual([{ id: 'pc2', year: 2031, kind: 'contribution', row: 'c1', amount: 0, scope: 'onward' }]);
    // the next id is one no other change has
    expect(addPlannerChange(v, { year: 2032, kind: 'convert', owner: 'p1', amount: 1 }).plannerChanges.map((c) => c.id)).toEqual(['pc2', 'pc3']);
  });

  it('cleaning keeps valid changes as numbers, renumbers them, and drops the rest', () => {
    const raw = {
      ...DEFAULT_HOUSEHOLD_VALUES,
      plannerChanges: [
        { id: 'pc7', year: '2030', kind: 'convert', owner: 'p1', amount: '40000' },
        { id: 'x', year: 2031, kind: 'convert', owner: 'p3', amount: 5 }, // no such person
        { year: 2031, kind: 'withdraw', owner: 'p1', amount: 5 }, // not a kind of change
        { year: 2031.5, kind: 'convert', owner: 'p1', amount: 5 }, // not a year
        { year: 2031, kind: 'convert', owner: 'p1', amount: -5 }, // negative
        { year: 2031, kind: 'convert', owner: 'p1', amount: 'lots' },
        { year: 2032, kind: 'contribution', row: 'c1', amount: 0, scope: 'sometimes' }, // scope -> 'year'
        { year: 2032, kind: 'contribution', row: 'c9', amount: 0, scope: 'year' }, // no such row
        'junk',
      ],
    };
    expect(cleanHouseholdValues(raw, Y).plannerChanges).toEqual([
      { id: 'pc1', year: 2030, kind: 'convert', owner: 'p1', amount: 40000 },
      { id: 'pc2', year: 2032, kind: 'contribution', row: 'c1', amount: 0, scope: 'year' },
    ]);
  });

  it('a contribution change follows its row when cleaning renumbers the rows', () => {
    // rows c1 and c3 (c2 was deleted) are saved as c1 and c2: the change on c3 moves to c2
    const raw = {
      ...DEFAULT_HOUSEHOLD_VALUES,
      contributions: [contribution('c1', '10000'), contribution('c3', '5000')],
      plannerChanges: [{ id: 'pc1', year: 2030, kind: 'contribution', row: 'c3', amount: 9000, scope: 'year' }],
    };
    const v = cleanHouseholdValues(raw, Y);
    expect(v.contributions.map((r) => [r.id, r.amount])).toEqual([['c1', '10000'], ['c2', '5000']]);
    expect(v.plannerChanges[0].row).toBe('c2');
  });

  it('removing a contribution row removes its changes (so a new row taking its id starts clean)', () => {
    let v = { ...DEFAULT_HOUSEHOLD_VALUES, contributions: [contribution('c1', '10000'), contribution('c2', '5000')] };
    v = addPlannerChange(v, { year: 2030, kind: 'contribution', row: 'c2', amount: 0, scope: 'onward' });
    v = addPlannerChange(v, { year: 2030, kind: 'convert', owner: 'p1', amount: 1000 });
    v = removeRow(v, 'contributions', 'c2');
    expect(v.plannerChanges.map((c) => c.kind)).toEqual(['convert']);
    expect(addRow(v, 'contributions').contributions.map((r) => r.id)).toEqual(['c1', 'c2']);
  });

  it('share links and saves carry them; a change marks the household unsaved', () => {
    const v = addPlannerChange(DEFAULT_HOUSEHOLD_VALUES, { year: 2060, kind: 'convert', owner: 'p1', amount: 25000 });
    const back = householdValuesV2FromSearch(householdLinkSearchV2(v), Y);
    expect(back.values.plannerChanges).toEqual(v.plannerChanges);
    expect(valuesV2FromCase(caseFromValuesV2(v), Y).plannerChanges).toEqual(v.plannerChanges);
    expect(sameSavedHouseholdV2(v, DEFAULT_HOUSEHOLD_VALUES)).toBe(false);
  });

  it('the household carries them (with their ids) to every calculator', () => {
    const v = addPlannerChange(DEFAULT_HOUSEHOLD_VALUES, { year: 2060, kind: 'convert', owner: 'p1', amount: 25000 });
    const h = toHouseholdV2(v, Y);
    expect(h.plannerChanges).toEqual([{ id: 'pc1', year: 2060, kind: 'convert', owner: 'p1', amount: 25000 }]);
    expect(toHouseholdV2(DEFAULT_HOUSEHOLD_VALUES, Y).plannerChanges).toEqual([]);
    const row = runProjection(h, { need: 60000 }).rows.find((r) => r.year === 2060);
    expect(row.conversions).toBeCloseTo(25000, 6);
  });
});

describe('the note on the pages that run the plan', () => {
  it('says what the planner added, or nothing', async () => {
    const { plannerChangesNote } = await import('../src/lib/planner.js');
    expect(plannerChangesNote([])).toBeNull();
    const changes = [
      { year: 2031, kind: 'convert', owner: 'p1', amount: 30000 },
      { year: 2030, kind: 'convert', owner: 'p2', amount: 40000 },
      { year: 2028, kind: 'contribution', row: 'c1', amount: 0, scope: 'onward' },
    ];
    expect(plannerChangesNote(changes)).toBe('The plan includes 2 Roth conversions (2030, 2031; $70,000 in all) and 1 contribution change (2028) from the year-by-year planner.');
    expect(plannerChangesNote(changes, { conversionsOnly: true })).toMatch(/only the conversions count here\.$/);
    expect(plannerChangesNote(changes.slice(0, 1), { conversionsOnly: true })).toBe('The plan includes 1 Roth conversion (2031; $30,000 in all) from the year-by-year planner.');
  });
});
