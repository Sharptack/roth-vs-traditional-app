// Medicare income-related monthly adjustment amounts (IRMAA), by premium year: the surcharges on
// the Part B and Part D premiums for people whose modified AGI (AGI plus tax-exempt interest) TWO
// YEARS EARLIER was above a threshold. Used by lib/irmaa.js.
//
// TO ADD A YEAR: copy the latest object, change the key and numbers (CMS publishes them each
// autumn in the "Medicare Parts B premiums and deductibles" fact sheet).
//
// tiers: in order. A tier applies when MAGI is ABOVE `over` (the tier below keeps MAGI equal to
//   the threshold), except the top tier, which applies AT `atLeast` or more (CMS: "greater than or
//   equal to $500,000"). Thresholds per filing status (single = individual return; mfj = joint).
//   partB / partD: the MONTHLY surcharge per person in that tier (Part B: the "income-related
//   monthly adjustment amount", the total premium less the standard premium; Part D: added to the
//   plan's own premium). Married filing separately (its own, harsher table) is not modeled.
// standardPartB: the standard Part B premium, for reference only (everyone pays it, whatever the
//   income, so it is part of spending, not a cost of income).
//
// Sources: cms.gov fact sheets "2026 Medicare Parts B Premiums and Deductibles" and "2025 Medicare
// Parts A & B Premiums and Deductibles" (both tables, Part B and Part D), fetched 2026-10-07.
// Indexing (Bipartisan Budget Act of 2018, secondary sources): the lower thresholds rise with CPI
// each year; the $500,000 / $750,000 top threshold is fixed until 2028, then indexed too.

const tiers = (over, atLeast, partB, partD) => [
  ...over.map(([single, mfj], i) => ({ over: { single, mfj }, partB: partB[i], partD: partD[i] })),
  { atLeast, partB: partB[over.length], partD: partD[over.length] },
];

export const IRMAA = {
  2025: {
    standardPartB: 185.0,
    tiers: tiers(
      [
        [106000, 212000],
        [133000, 266000],
        [167000, 334000],
        [200000, 400000],
      ],
      { single: 500000, mfj: 750000 },
      [74.0, 185.0, 295.9, 406.9, 443.9],
      [13.7, 35.3, 57.0, 78.6, 85.8],
    ),
  },
  2026: {
    standardPartB: 202.9,
    tiers: tiers(
      [
        [109000, 218000],
        [137000, 274000],
        [171000, 342000],
        [205000, 410000],
      ],
      { single: 500000, mfj: 750000 },
      [81.2, 202.9, 324.6, 446.3, 487.0],
      [14.5, 37.5, 60.4, 83.3, 91.0],
    ),
  },
};

// Medicare starts at 65 (assumed: everyone 65 or older has Part B and Part D).
export const MEDICARE_AGE = 65;
// The premium for year Y is set by the tax return for year Y - 2.
export const IRMAA_LOOKBACK_YEARS = 2;
