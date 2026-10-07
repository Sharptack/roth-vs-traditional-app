import { describe, it, expect } from 'vitest';
import { YEARLY_TABLES, latestYear } from '../src/data/yearlyTables.js';

// The annual reminder: from January 1 these fail until each yearly table has the new year's figures.
// To fix: follow docs/annual-update.md (add the new year's object to each file listed here).
describe('annual tax data is up to date', () => {
  const thisYear = new Date().getFullYear();
  for (const t of YEARLY_TABLES) {
    it(`${t.name} has figures for ${thisYear} (${t.file})`, () => {
      expect(latestYear(t.table), `${t.file} needs ${thisYear}: ${t.what}. See docs/annual-update.md.`).toBeGreaterThanOrEqual(thisYear);
    });
  }

  it('every yearly table has the same latest year (none forgotten)', () => {
    const years = new Set(YEARLY_TABLES.map((t) => latestYear(t.table)));
    expect([...years]).toHaveLength(1);
  });
});
