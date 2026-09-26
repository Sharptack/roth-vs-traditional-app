// Net Investment Income Tax (NIIT): an extra 3.8% on investment income for
// higher-income taxpayers, on top of the regular capital-gains tax.
//
// Tax = rate × the SMALLER of
//   - net investment income (here: the gain part of taxable-account withdrawals), or
//   - modified AGI above the filing-status threshold.
// MAGI is AGI (plus foreign-income items this calculator doesn't model), so it
// includes Pre-tax withdrawals and taxable Social Security. Those are NOT
// investment income themselves, but they count toward the threshold, so a
// bigger Pre-tax withdrawal can expose more taxable-account gains to the NIIT.
// Roth withdrawals and returned cost basis are in neither.
//
// The thresholds are fixed by statute (IRC §1411) and NOT indexed for
// inflation. Keyed by the year they took effect (2013), same pattern as
// ssTaxThresholds.js: getYearData picks the latest year <= the one requested.
//
// Sources: IRS Topic 559 (rate, thresholds, "lesser of" rule) and the IRS
// "Questions and Answers on the Net Investment Income Tax" (not indexed; MAGI
// definition; Social Security and qualified-plan distributions are not net
// investment income; stock and fund gains are). Both checked 2026-09-25.
export const NIIT_RATES = {
  2013: {
    rate: 0.038,
    threshold: { single: 200000, mfj: 250000 },
  },
};
