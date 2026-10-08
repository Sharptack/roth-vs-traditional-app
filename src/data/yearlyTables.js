// Every data table that changes each year, in one list: the annual tax-law update works through it
// (docs/annual-update.md), and tests/yearlyTables.test.js fails from January 1 until each table has
// the new year's figures, so a stale year can't slip by unnoticed. (Until then the app keeps working
// on the latest year on file: getYearData picks the latest year <= the one requested.)
//
// Not listed, because the law fixes them rather than indexing them: Social Security taxability
// thresholds (ssTaxThresholds.js), NIIT thresholds (niitRates.js), the RMD table and start ages
// (rmdTable.js), full retirement ages (ssBendPoints.js). Check them only when the law changes.
import { TAX_BRACKETS } from './taxBrackets.js';
import { CAPITAL_GAINS_BRACKETS } from './capitalGainsBrackets.js';
import { FICA_RATES } from './ficaRates.js';
import { SS_BEND_POINTS } from './ssBendPoints.js';
import { CONTRIBUTION_LIMITS } from './contributionLimits.js';
import { AGE_DEDUCTIONS } from './ageDeductions.js';
import { IRMAA } from './irmaa.js';
import { QBI } from './qbi.js';
import { IRA_RULES } from './iraRules.js';
import { CHILD_TAX_CREDIT } from './childTaxCredit.js';

// file: where to edit; what: the figures to update; when: when they are usually published.
export const YEARLY_TABLES = [
  {
    name: 'Income tax brackets and standard deduction',
    table: TAX_BRACKETS,
    file: 'src/data/taxBrackets.js',
    what: 'ordinary brackets and the standard deduction, single and joint',
    when: 'IRS revenue procedure, October-November',
  },
  {
    name: 'Capital gains brackets',
    table: CAPITAL_GAINS_BRACKETS,
    file: 'src/data/capitalGainsBrackets.js',
    what: '0% / 15% / 20% thresholds',
    when: 'same IRS revenue procedure',
  },
  {
    name: 'Payroll tax',
    table: FICA_RATES,
    file: 'src/data/ficaRates.js',
    what: 'Social Security wage base (rates and Additional Medicare thresholds rarely change)',
    when: 'SSA, October (with the COLA announcement)',
  },
  {
    name: 'Social Security bend points',
    table: SS_BEND_POINTS,
    file: 'src/data/ssBendPoints.js',
    what: 'the two PIA bend points',
    when: 'SSA, October',
  },
  {
    name: 'Contribution limits',
    table: CONTRIBUTION_LIMITS,
    file: 'src/data/contributionLimits.js',
    what: '401(k) and IRA limits, catch-up amounts (50+, and 60-63 for 401(k))',
    when: 'IRS notice and newsroom release, October-November',
  },
  {
    name: 'Age 65+ deductions',
    table: AGE_DEDUCTIONS,
    file: 'src/data/ageDeductions.js',
    what: 'the additional standard deduction at 65 (the senior deduction is fixed, 2025-2028)',
    when: 'same IRS revenue procedure',
  },
  {
    name: 'Medicare IRMAA',
    table: IRMAA,
    file: 'src/data/irmaa.js',
    what: 'Part B and Part D surcharges and the income thresholds',
    when: 'CMS fact sheet, October-November',
  },
  {
    name: 'QBI deduction',
    table: QBI,
    file: 'src/data/qbi.js',
    what: 'threshold and phase-in end, single and joint (the $400 / $1,000 minimum is indexed from 2027)',
    when: 'same IRS revenue procedure',
  },
  {
    name: 'IRA income limits and the Roth catch-up wage threshold',
    table: IRA_RULES,
    file: 'src/data/iraRules.js',
    what: 'Roth IRA and Traditional IRA deduction phase-out ranges; the Roth catch-up FICA-wage threshold',
    when: 'IRS notice and newsroom release (with the contribution limits), October-November',
  },
  {
    name: 'Child tax credit',
    table: CHILD_TAX_CREDIT,
    file: 'src/data/childTaxCredit.js',
    what: 'the credit per child (indexed from 2026) and the refundable amount; the $500 and the phase-out are fixed',
    when: 'same IRS revenue procedure',
  },
];

export const latestYear = (table) => Math.max(...Object.keys(table).map(Number));
