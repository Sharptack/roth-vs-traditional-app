// Long-term capital gains tax brackets, by tax year and filing status.
//
// TO ADD A YEAR: copy the 2025 object, change the key and edit the numbers.
//
// Unlike ordinary brackets, the rate is 0% up to the first threshold: most
// retirees with modest other income pay NO tax on long-term gains. Above that,
// 15%, then 20% at the top. Thresholds are on TAXABLE income (after the standard
// deduction) — the same "taxable income" the ordinary brackets use — and gains
// are taxed as if STACKED ON TOP of ordinary income (see capitalGainsTax.js).
//
// Sources:
//   2025: IRS Topic 409 ("Capital gains and losses"), fetched directly —
//     Single/MFS: 0% <= $48,350; 15% $48,350–$533,400; 20% above.
//     MFJ: 0% <= $96,700; 15% $96,700–$600,050; 20% above.
//   2026: IRS Rev. Proc. 2025-32 ("One, Big, Beautiful Bill" inflation
//     adjustments). The published PDF wasn't machine-readable, so these are
//     corroborated from secondary reporting (CNBC, Kiplinger) rather than
//     fetched directly — re-verify against the IRS PDF when convenient.
//     Single: 0% <= $49,450; 15% $49,450–$545,500; 20% above.
//     MFJ: 0% <= $98,900; 15% $98,900–$613,700; 20% above.
//
// NOT modeled: the Net Investment Income Tax (an extra 3.8% on investment
// income above $200,000 Single / $250,000 MFJ of modified AGI).
export const CAPITAL_GAINS_BRACKETS = {
  2025: {
    single: [
      { rate: 0, upTo: 48350 },
      { rate: 0.15, upTo: 533400 },
      { rate: 0.2, upTo: Infinity },
    ],
    mfj: [
      { rate: 0, upTo: 96700 },
      { rate: 0.15, upTo: 600050 },
      { rate: 0.2, upTo: Infinity },
    ],
  },
  2026: {
    single: [
      { rate: 0, upTo: 49450 },
      { rate: 0.15, upTo: 545500 },
      { rate: 0.2, upTo: Infinity },
    ],
    mfj: [
      { rate: 0, upTo: 98900 },
      { rate: 0.15, upTo: 613700 },
      { rate: 0.2, upTo: Infinity },
    ],
  },
};
