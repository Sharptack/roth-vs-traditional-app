// The "How are the retirement rates calculated?" walk-through as plain data,
// so the one-scenario dropdown and the side-by-side scenario comparison show
// exactly the same steps. Pure: reads fields already on compare.js's result,
// no new financial logic.
//
// Each row: { key, label, detail?, value?, format?, kind }
//   key     stable id, used to line up two scenarios' rows
//   label   fixed text (no scenario numbers in it, so it reads the same in both columns)
//   detail  the scenario's own arithmetic, e.g. "$65,380 − $61,497" (optional)
//   value   a number (absent on headings)
//   format  'currency' | 'percent' | 'bracket' (a whole-number rate)
//   kind    '' | 'sub' | 'total' | 'heading'
import { formatCurrency as $ } from './format.js';

const heading = (key, label) => ({ key, label, kind: 'heading' });
const money = (key, label, value, kind = 'sub', detail) => ({
  key,
  label,
  value,
  format: 'currency',
  kind,
  ...(detail ? { detail } : {}),
});

// Tax on one retirement stack: split into ordinary + capital-gains tax when there
// are taxable-account withdrawals, one row otherwise.
function taxRows(prefix, stack, hasGains, totalLabel) {
  if (!hasGains) return [money(`${prefix}Tax`, totalLabel, stack.totalTax)];
  return [
    money(`${prefix}OrdinaryTax`, 'Income tax on ordinary income', stack.ordinaryTax),
    money(
      `${prefix}CapitalGainsTax`,
      'Capital-gains tax on taxable-account withdrawals (0% / 15% / 20%, stacked on top of ordinary income)',
      stack.capitalGainsTax,
    ),
    money(`${prefix}Tax`, totalLabel, stack.totalTax),
  ];
}

// The extra tax split into its two parts, when capital gains are involved.
function extraTaxSplitRows(d) {
  if (!(d.extraCapitalGainsTax > 0.5)) return [];
  return [
    money('extraOrdinaryTax', '…of which extra income tax', d.extraOrdinaryTax),
    money(
      'extraCapitalGainsTax',
      '…of which extra capital-gains tax (gains pushed into a higher bracket)',
      d.extraCapitalGainsTax,
    ),
  ];
}

export function effectiveRateSteps(result) {
  const { grossUp: g, otherWithdrawals: o, socialSecurity: ss, retirementNeed, rates } = result;
  const d = result.rateDrivers;
  const overall = result.retirementOverall;
  const hasGains = o.taxableGross > 0;
  const withdrawalNeeded = g.grossWithdrawal > 0;

  const rows = [
    heading('step1', 'Step 1: income from Social Security and Existing Accounts'),
    money('ssBenefit', 'Social Security benefit', ss.annualBenefit),
    money('otherPretax', 'Existing Accounts, Pre-tax (4% withdrawal)', o.pretaxGross),
    ...(o.roth > 0 ? [money('otherRoth', 'Existing Accounts, Roth (4%, tax-free)', o.roth)] : []),
    ...(hasGains ? [money('otherTaxable', 'Existing Accounts, taxable (4% withdrawal)', o.taxableGross)] : []),
    money('baseTaxableSS', 'Taxable part of Social Security (IRS combined-income rules)', g.baseStack.taxableSS),
    money(
      'baseTaxableIncome',
      'Taxable income after the standard deduction',
      g.baseStack.ordinaryTaxableIncome,
      'sub',
      `${$(result.current.standardDeduction)} deduction`,
    ),
    ...taxRows('base', g.baseStack, hasGains, 'Tax on that income'),
    money('afterTaxOther', 'After-tax income from Social Security and Existing Accounts', g.afterTaxFromOtherSources, 'total'),

    heading('step2', 'Step 2: what Future Contributions have to supply'),
    money('need', 'Retirement income number', retirementNeed.target),
    money(
      'stillNeeded',
      'Still needed from Future Contributions, after tax',
      g.remainingAfterTaxNeed,
      'sub',
      `${$(retirementNeed.target)} − ${$(g.afterTaxFromOtherSources)}`,
    ),
  ];

  if (withdrawalNeeded) {
    rows.push(
      money('grossWithdrawal', 'Pre-tax withdrawal that delivers that amount after tax', g.grossWithdrawal, 'total'),
      heading('step3', 'Step 3: add that withdrawal and re-do the tax'),
      money('solutionTaxableSS', 'Taxable part of Social Security', g.solutionStack.taxableSS),
      money('solutionTaxableIncome', 'Taxable income after the standard deduction', g.solutionStack.ordinaryTaxableIncome),
      ...taxRows('solution', g.solutionStack, hasGains, 'Total tax'),
      money(
        'extraTax',
        'Extra tax caused by the withdrawal',
        d.extraTax,
        'total',
        `${$(g.solutionStack.totalTax)} − ${$(g.baseStack.totalTax)}`,
      ),
    );
  } else {
    rows.push(
      money('grossWithdrawal', 'Withdrawal needed from Future Contributions', 0, 'total'),
      heading('step3', 'Step 3: what a withdrawal from it would cost, if you took one'),
      money('probeSize', "Future Contributions' own natural withdrawal (4% of their projected value)", g.probeSize),
      money('extraTax', 'Extra tax that withdrawal would cause', g.probeExtraTax),
    );
  }

  rows.push(
    ...extraTaxSplitRows(d),
    {
      key: 'effectiveRate',
      label: 'Effective rate on these withdrawals',
      detail: `${$(d.extraTax)} ÷ ${$(d.withdrawal)}`,
      value: rates.effectiveRetirement,
      format: 'percent',
      kind: 'total',
    },
    {
      key: 'overallRate',
      label: 'Overall effective rate',
      detail: `${$(overall.totalTax)} total tax ÷ ${$(overall.grossIncome)} gross income`,
      value: rates.overallEffectiveRetirement,
      format: 'percent',
      kind: 'total',
    },
  );
  return rows;
}

// The "What sets the rate" facts as rows, for comparing two scenarios.
export function rateDriverRows(result) {
  const d = result.rateDrivers;
  return [
    heading('drivers', 'What sets the rate'),
    money('driverWithdrawal', d.hypothetical ? 'Withdrawal the rate is measured on (hypothetical)' : 'Withdrawal the rate is measured on', d.withdrawal),
    money('driverIncomeFirst', 'Ordinary income taxed ahead of it (Pre-tax Existing Accounts + taxable Social Security)', d.ordinaryIncomeBefore),
    { key: 'driverStart', label: 'Bracket of its first dollar', value: d.startBracket, format: 'bracket', kind: 'sub' },
    { key: 'driverEnd', label: 'Bracket of its last dollar', value: d.endBracket, format: 'bracket', kind: 'sub' },
    money('driverSS', 'Social Security it pulls into taxable income', d.extraTaxableSS),
    money('driverGains', 'Capital-gains tax it adds', d.extraCapitalGainsTax),
  ];
}
