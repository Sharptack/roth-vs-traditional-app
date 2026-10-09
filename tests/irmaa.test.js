import { describe, it, expect } from 'vitest';
import { irmaaCost, irmaaFromThisYear, irmaaTier, medicareEnrollees } from '../src/lib/irmaa.js';

// Every figure from the cms.gov fact sheets (src/data/irmaa.js), worked by hand.
describe('irmaaTier (HAND CALC)', () => {
  it('2026 single: under the first threshold pays nothing; the room is up to $109,000', () => {
    const t = irmaaTier(100000, 'single', 2026);
    expect(t.tier).toBe(0);
    expect(t.annual).toBe(0);
    expect(t.nextThreshold).toBe(109000);
    expect(t.roomToNext).toBeCloseTo(9000, 6);
  });

  it('exactly at a threshold stays in the tier below; one cent over moves up', () => {
    expect(irmaaTier(109000, 'single', 2026).tier).toBe(0);
    expect(irmaaTier(109000, 'single', 2026).roomToNext).toBeCloseTo(0, 6);
    // tier 1: Part B 81.20 + Part D 14.50 = 95.70 a month x 12 = 1,148.40 a year
    const t = irmaaTier(109000.01, 'single', 2026);
    expect(t.tier).toBe(1);
    expect(t.monthly).toBeCloseTo(95.7, 6);
    expect(t.annual).toBeCloseTo(1148.4, 6);
  });

  it('2026 single $150,000: tier 2 ($137,000-$171,000), $2,884.80 per year, $21,000 of room', () => {
    // 202.90 + 37.50 = 240.40 a month x 12 = 2,884.80
    const t = irmaaTier(150000, 'single', 2026);
    expect(t.tier).toBe(2);
    expect(t.partB).toBeCloseTo(202.9, 6);
    expect(t.partD).toBeCloseTo(37.5, 6);
    expect(t.annual).toBeCloseTo(2884.8, 6);
    expect(t.nextThreshold).toBe(171000);
    expect(t.roomToNext).toBeCloseTo(21000, 6);
  });

  it('the top tier starts AT $500,000 (not above it)', () => {
    // tier 4: 446.30 + 83.30 = 529.60 a month x 12 = 6,355.20; adding one more cent reaches $500,000
    const below = irmaaTier(499999.99, 'single', 2026);
    expect(below.tier).toBe(4);
    expect(below.annual).toBeCloseTo(6355.2, 6);
    expect(below.roomToNext).toBeCloseTo(0, 6);
    // tier 5: 487.00 + 91.00 = 578.00 a month x 12 = 6,936.00; nothing above it
    const top = irmaaTier(500000, 'single', 2026);
    expect(top.tier).toBe(5);
    expect(top.annual).toBeCloseTo(6936, 6);
    expect(top.nextThreshold).toBeNull();
    expect(top.roomToNext).toBeNull();
  });

  it('joint thresholds, and the 2025 table', () => {
    // 2026 joint $300,000: tier 2 ($274,000-$342,000); the amounts are per person
    expect(irmaaTier(300000, 'mfj', 2026).tier).toBe(2);
    expect(irmaaTier(300000, 'mfj', 2026).roomToNext).toBeCloseTo(42000, 6);
    expect(irmaaTier(218000, 'mfj', 2026).tier).toBe(0);
    // 2025 single $120,000: tier 1 ($106,000-$133,000): 74.00 + 13.70 = 87.70 x 12 = 1,052.40
    expect(irmaaTier(120000, 'single', 2025).annual).toBeCloseTo(1052.4, 6);
    // a later year uses the newest table on file
    expect(irmaaTier(120000, 'single', 2031).annual).toBeCloseTo(1148.4, 6);
  });
});

describe('irmaaCost and who is on Medicare', () => {
  it('a couple both on Medicare pays the per-person surcharge twice', () => {
    // 2026 joint $300,000: 2,884.80 each -> 5,769.60
    const c = irmaaCost({ magi: 300000, filingStatus: 'mfj', year: 2026, enrolled: 2 });
    expect(c.total).toBeCloseTo(5769.6, 6);
    expect(c.enrolled).toBe(2);
    expect(irmaaCost({ magi: 300000, filingStatus: 'mfj', year: 2026, enrolled: 0 }).total).toBe(0);
  });

  it("this year's MAGI sets the premium two years on, for whoever is 65 by then", () => {
    // 2026 single $150,000: tier 2, 2,884.80 a person; at 63 now -> 65 in 2028: one person pays
    const at63 = irmaaFromThisYear({ magi: 150000, filingStatus: 'single', year: 2026, ages: [63] });
    expect(at63.premiumYear).toBe(2028);
    expect(at63.enrolled).toBe(1);
    expect(at63.total).toBeCloseTo(2884.8, 6);
    // at 62 now -> 64 in 2028: the tier is shown, but no one pays
    const at62 = irmaaFromThisYear({ magi: 150000, filingStatus: 'single', year: 2026, ages: [62] });
    expect(at62.tier).toBe(2);
    expect(at62.total).toBe(0);
  });

  it('Medicare from 65', () => {
    expect(medicareEnrollees([64, 65])).toBe(1);
    expect(medicareEnrollees([70, 66])).toBe(2);
    expect(medicareEnrollees([40])).toBe(0);
  });
});
