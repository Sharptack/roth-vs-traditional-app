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
// Sources (checked against irs.gov):
//   2025 brackets: irs.gov/filing/federal-income-tax-rates-and-brackets.
//        Standard deduction $15,750 single / $31,500 MFJ, as raised by P.L. 119-21
//        (July 2025) — IRS Pub. 501 (2025).
//   2026 brackets and standard deduction ($16,100 / $32,200): IRS "tax inflation
//        adjustments for tax year 2026, including amendments from the One Big
//        Beautiful Bill" (irs.gov/newsroom).
//
// Not modeled: the additional standard deduction for age 65+, and the temporary
// senior deduction created by P.L. 119-21. Both would lower retirement tax.
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
  2026: {
    standardDeduction: {
      single: 16100,
      mfj: 32200,
    },
    brackets: {
      single: [
        { rate: 0.10, upTo: 12400 },
        { rate: 0.12, upTo: 50400 },
        { rate: 0.22, upTo: 105700 },
        { rate: 0.24, upTo: 201775 },
        { rate: 0.32, upTo: 256225 },
        { rate: 0.35, upTo: 640600 },
        { rate: 0.37, upTo: Infinity },
      ],
      mfj: [
        { rate: 0.10, upTo: 24800 },
        { rate: 0.12, upTo: 100800 },
        { rate: 0.22, upTo: 211400 },
        { rate: 0.24, upTo: 403550 },
        { rate: 0.32, upTo: 512450 },
        { rate: 0.35, upTo: 768700 },
        { rate: 0.37, upTo: Infinity },
      ],
    },
  },
};
