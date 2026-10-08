// Who can contribute to what, by tax year (round 2 phase 1): the income ranges over which a Roth
// IRA contribution and a Traditional IRA deduction phase out (modified AGI), and SECURE 2.0's
// Roth catch-up rule.
//
//   rothIra          the Roth IRA contribution phases out from `from` to `to`
//   deduction        the Traditional IRA deduction phases out:
//     covered          for someone covered by a workplace retirement plan (single, joint)
//     spouseCovered    for someone not covered whose spouse is (joint)
//                      (no one covered: fully deductible at any income)
//   rothCatchUpWages from 2026, catch-up contributions to a 401(k)-type plan must be Roth for
//                    someone whose prior-year FICA wages were above this; null before
//
// Married filing separately (a $0 to $10,000 range) is not modeled: the app has no MFS status.
// Sources: IRS IR-2025-111, "401(k) limit increases to $24,500 for 2026, IRA limit increases to
// $7,500" (2026 ranges, and the 2025 Roth and spouse-covered ranges it compares them with);
// IRS Notice 2024-80 (the 2025 covered ranges); the final Roth catch-up regulations (Sept. 2025)
// and IRS Notice 2025-67 ($150,000 of 2025 FICA wages for 2026).
export const IRA_RULES = {
  2025: {
    rothIra: { single: { from: 150000, to: 165000 }, mfj: { from: 236000, to: 246000 } },
    deduction: {
      covered: { single: { from: 79000, to: 89000 }, mfj: { from: 126000, to: 146000 } },
      spouseCovered: { mfj: { from: 236000, to: 246000 } },
    },
    rothCatchUpWages: null,
  },
  2026: {
    rothIra: { single: { from: 153000, to: 168000 }, mfj: { from: 242000, to: 252000 } },
    deduction: {
      covered: { single: { from: 81000, to: 91000 }, mfj: { from: 129000, to: 149000 } },
      spouseCovered: { mfj: { from: 242000, to: 252000 } },
    },
    rothCatchUpWages: 150000,
  },
};
