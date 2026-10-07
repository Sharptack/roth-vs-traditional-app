# Annual tax-law update

Once a year, usually in November (when the IRS, SSA and CMS have all published) and no later than
January, add the new year's figures. Until then the app keeps working on the latest year on file, and
`tests/yearlyTables.test.js` fails from January 1 as a reminder.

## The tables

The list lives in code, `src/data/yearlyTables.js`, so this checklist and the test can't disagree:

| Table | File | Figures | Published |
| --- | --- | --- | --- |
| Income tax brackets and standard deduction | `src/data/taxBrackets.js` | brackets, standard deduction | IRS revenue procedure, Oct-Nov |
| Capital gains brackets | `src/data/capitalGainsBrackets.js` | 0% / 15% / 20% thresholds | same revenue procedure |
| Payroll tax | `src/data/ficaRates.js` | Social Security wage base | SSA, October |
| Social Security bend points | `src/data/ssBendPoints.js` | the two bend points | SSA, October |
| Contribution limits | `src/data/contributionLimits.js` | 401(k), IRA, catch-up amounts | IRS notice, Oct-Nov |
| Age 65+ deductions | `src/data/ageDeductions.js` | additional standard deduction | same revenue procedure |
| Medicare IRMAA | `src/data/irmaa.js` | Part B and D surcharges, thresholds | CMS fact sheet, Oct-Nov |

Fixed by law, checked only when the law changes: Social Security taxability thresholds, NIIT
thresholds, the RMD table and start ages, full retirement ages, the senior deduction (2025-2028).

## Steps

1. In each file above, copy the latest year's object, change the key to the new year, and update the
   figures. Each file's header comment names its sources; fetch the official page (irs.gov, ssa.gov,
   cms.gov) and record the date checked.
2. Run `npm test`. The yearly-tables tests should pass. Hand-worked tests pin their own year
   (`year: 2025` / `2026`), so they keep passing; the smoke tests use the current year and may show new
   numbers, which is expected.
3. Look over the preview and the public calculator for figures that changed.
4. Update the "Data provenance" section in CLAUDE.md, commit, and push when ready.

If a law change adds a NEW kind of yearly figure, add its table to `src/data/yearlyTables.js` so the
reminder covers it.
