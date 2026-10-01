// Deductions for age 65 and older, by tax year (used by the single-year engine, yearTax.js).
//
// TO ADD A YEAR: copy the latest object, change the key and numbers.
//
// additional65: the additional standard deduction for each person 65 or older by the end of the
//   year: the unmarried amount for single filers, the per-spouse amount for married filing jointly.
//   (The blindness add-on is not modeled.)
// senior: the temporary "enhanced deduction for seniors" (P.L. 119-21, 2025 through 2028): $6,000
//   per person 65 or older, for itemizers and non-itemizers alike, reduced by 6% of modified AGI
//   over $75,000 ($150,000 joint). For a couple the 6% reduction applies to EACH spouse's $6,000,
//   using the household's MAGI (both gone at $250,000). `lastYear`: none after 2028.
//
// Sources: irs.gov newsroom, "One Big Beautiful Bill Act: tax deductions for working Americans and
// seniors" ($6,000, age 65, 2025-2028, $75,000 / $150,000), fetched 2026-10-01. The 6% rate,
// the per-spouse reduction and the 2026 additional amounts ($2,050 / $1,650) are from secondary
// sources (Kiplinger, Tax Foundation, Thomson Reuters), not yet checked against an IRS page.
// 2025 additional amounts ($2,000 / $1,600): IRS Rev. Proc. 2024-40.
const SENIOR = {
  amount: 6000,
  phaseOutStart: { single: 75000, mfj: 150000 },
  phaseOutRate: 0.06,
  lastYear: 2028,
};

export const AGE_DEDUCTIONS = {
  2025: { additional65: { single: 2000, mfj: 1600 }, senior: SENIOR },
  2026: { additional65: { single: 2050, mfj: 1650 }, senior: SENIOR },
};
