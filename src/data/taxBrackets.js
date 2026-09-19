// Federal ordinary-income tax brackets and standard deduction, by tax year and
// filing status.
//
// TO ADD A YEAR: copy the whole 2025 object below, change the key, and edit the
// numbers. Nothing else needs to change — lib code picks the latest year that is
// <= the requested year (see src/lib/yearLookup.js).
//
// Each bracket is { rate, upTo }: `upTo` is the TOP of that bracket in taxable
// dollars (Infinity for the last one). A bracket's bottom is the previous
// bracket's `upTo` (0 for the first).
//
// Filing status keys: 'single' | 'mfj' (married filing jointly).
//
// 2025 sources: IRS Rev. Proc. 2024-40 (brackets); standard deduction as amended
// by P.L. 119-21 (July 2025): $15,750 single / $31,500 MFJ.
export const TAX_BRACKETS = {
  2025: {
    standardDeduction: {
      single: 15750,
      mfj: 31500,
    },
    brackets: {
      single: [
        { rate: 0.10, upTo: 11925 },
        { rate: 0.12, upTo: 48475 },
        { rate: 0.22, upTo: 103350 },
        { rate: 0.24, upTo: 197300 },
        { rate: 0.32, upTo: 250525 },
        { rate: 0.35, upTo: 626350 },
        { rate: 0.37, upTo: Infinity },
      ],
      mfj: [
        { rate: 0.10, upTo: 23850 },
        { rate: 0.12, upTo: 96950 },
        { rate: 0.22, upTo: 206700 },
        { rate: 0.24, upTo: 394600 },
        { rate: 0.32, upTo: 501050 },
        { rate: 0.35, upTo: 751600 },
        { rate: 0.37, upTo: Infinity },
      ],
    },
  },
};
