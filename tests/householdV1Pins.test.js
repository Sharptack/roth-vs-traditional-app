// Round 2 phase 0: every calculator's results for the version 1 example households
// (tests/fixtures/householdV1.js), pinned as they are today. These are regression pins, not hand
// calculations: the version 2 household must open each of them with the same results. A change
// here means a version 1 household no longer opens unchanged; update the snapshot only on purpose.
import { describe, it, expect } from 'vitest';
import { HOUSEHOLD_FORM_KEYS } from '../src/lib/householdLink.js';
import { PREVIEW_DEFAULT_VALUES } from '../src/lib/household.js';
import { V1_HOUSEHOLDS } from './fixtures/householdV1.js';
import { pinsFor } from './fixtures/householdPins.js';

describe('version 1 households: every calculator, pinned (round 2 phase 0)', () => {
  it('the examples between them move every version 1 form field off its default', () => {
    const fields = [...HOUSEHOLD_FORM_KEYS, 'otherPretaxBalance', 'otherRothBalance', 'otherTaxableBalance', 'otherTaxableBasis'];
    const examples = Object.values(V1_HOUSEHOLDS);
    const untouched = fields.filter((k) => examples.every((v) => v[k] === PREVIEW_DEFAULT_VALUES[k]));
    expect(untouched).toEqual([]);
  });

  for (const [name, values] of Object.entries(V1_HOUSEHOLDS)) {
    it(name, () => {
      expect(pinsFor(values)).toMatchSnapshot();
    });
  }
});
