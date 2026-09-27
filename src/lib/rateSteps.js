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
import { formatCurrency as $, formatPercent } from './format.js';

const heading = (key, label) => ({ key, label, kind: 'heading' });
const money = (key, label, value, kind = 'sub', detail) => ({
  key,
  label,
  value,
  format: 'currency',
  kind,
  ...(detail ? { detail } : {}),
});

// Tax on one retirement stack: split into ordinary + capital-gains tax (+ NIIT, when
// owed) when there are taxable-account withdrawals, one row otherwise.
function taxRows(prefix, stack, hasGains, totalLabel) {
  if (!hasGains) return [money(`${prefix}Tax`, totalLabel, stack.totalTax)];
  return [
    money(`${prefix}OrdinaryTax`, 'Income tax on ordinary income', stack.ordinaryTax),
    money(
      `${prefix}CapitalGainsTax`,
      'Capital-gains tax on taxable-account withdrawals (0% / 15% / 20%, stacked on top of ordinary income)',
      stack.capitalGainsTax,
    ),
    ...(stack.niit > 0.5 ? [money(`${prefix}Niit`, NIIT_LABEL, stack.niit)] : []),
    money(`${prefix}Tax`, totalLabel, stack.totalTax),
  ];
}

const NIIT_LABEL = 'Net Investment Income Tax (3.8% on gains, above $200,000 / $250,000 joint MAGI)';

// The extra tax split into its parts, when capital gains are involved.
function extraTaxSplitRows(d) {
  if (!(d.extraCapitalGainsTax > 0.5 || d.extraNiit > 0.5)) return [];
  return [
    money('extraOrdinaryTax', '…of which extra income tax', d.extraOrdinaryTax),
    money(
      'extraCapitalGainsTax',
      '…of which extra capital-gains tax (gains pushed into a higher bracket)',
      d.extraCapitalGainsTax,
    ),
    ...(d.extraNiit > 0.5
      ? [money('extraNiit', '…of which extra Net Investment Income Tax (more gains over the MAGI threshold)', d.extraNiit)]
      : []),
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
    ...(hasGains
      ? [
          money('otherTaxable', 'Existing Accounts, taxable (4% withdrawal)', o.taxableGross),
          money(
            'otherTaxableGains',
            '…of which gains (taxed; the rest is cost basis)',
            o.taxableGains,
            'sub',
            `${formatPercent(o.taxableGainShare, 0)} of the withdrawal`,
          ),
        ]
      : []),
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
      // The same re-do of the tax as Step 3 above, on that hypothetical withdrawal.
      money(
        'probeTaxableSS',
        'Taxable part of Social Security, with that withdrawal added',
        g.probeStack.taxableSS,
        'sub',
        g.probeStack.taxableSS - g.baseStack.taxableSS > 0.5 ? `was ${$(g.baseStack.taxableSS)}` : 'unchanged',
      ),
      money(
        'probeTaxableIncome',
        'Taxable income after the standard deduction, with that withdrawal added',
        g.probeStack.ordinaryTaxableIncome,
        'sub',
        `was ${$(g.baseStack.ordinaryTaxableIncome)}`,
      ),
      ...taxRows('probe', g.probeStack, hasGains, 'Total tax, with that withdrawal added'),
      money(
        'extraTax',
        'Extra tax that withdrawal would cause',
        g.probeExtraTax,
        'total',
        `${$(g.probeStack.totalTax)} − ${$(g.baseStack.totalTax)} without it`,
      ),
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
    money('driverNiit', 'Net Investment Income Tax it adds', d.extraNiit),
  ];
}

// The duplicate ("new calculation") rates block's walk-through, from result.sideAware
// (sideAwareRates.js). Empty when there is no account withdrawal to measure.
export function sideAwareRateSteps(result) {
  const s = result.sideAware;
  if (!s.available) return [];
  const o = result.otherWithdrawals;
  const st = s.stacks;
  const hasSide = s.pretaxSide.withdrawal > 0.5 || s.rothSide.withdrawal > 0.5;
  const hasExistingGains = o.taxableGross > 0;
  const pct = (v) => formatPercent(v);

  const rows = [
    heading('nStep1', 'Step 1: income from Social Security and Existing Accounts'),
    money('nSs', 'Social Security benefit', result.socialSecurity.annualBenefit),
    money('nOtherPretax', 'Existing Accounts, Pre-tax (4% withdrawal)', o.pretaxGross),
    ...(hasExistingGains
      ? [
          money('nOtherTaxable', 'Existing Accounts, taxable (4% withdrawal)', o.taxableGross),
          money('nOtherGains', '…of which gains (taxed; the rest is cost basis)', o.taxableGains),
        ]
      : []),
    money('nExistingTax', 'Tax on that income', st.existing.totalTax),
  ];

  if (hasSide) {
    rows.push(
      heading('nStep2', 'Step 2: the taxable accounts Future Contributions build (savings above the IRS limit)'),
      money('nRothSide', 'Roth scenario: its taxable account (4% withdrawal)', s.rothSide.withdrawal, 'sub', `${$(s.rothSide.gains)} of it gains`),
      money('nPretaxSide', 'Pre-tax scenario: its taxable account (4% withdrawal)', s.pretaxSide.withdrawal, 'sub', `${$(s.pretaxSide.gains)} of it gains`),
      money('nExtraSide', 'Extra taxable money the Pre-tax scenario holds (the tax its deduction saved, invested)', s.extraSide.withdrawal),
      money('nTaxPretaxSide', "Total tax with the Pre-tax scenario's taxable account added", st.preTaxWorldBeforeAccount.totalTax),
      money('nTaxRothSide', "Total tax with the Roth scenario's taxable account added", st.rothWorld.totalTax),
      money(
        'nExtraSideTax',
        'Extra tax on the extra taxable money',
        s.extraSideTax,
        'sub',
        `${$(st.preTaxWorldBeforeAccount.totalTax)} − ${$(st.rothWorld.totalTax)}`,
      ),
      {
        key: 'nExtraSideRate',
        label: 'Tax rate on the extra taxable money',
        detail: `${$(s.extraSideTax)} ÷ ${$(s.extraSide.withdrawal)}`,
        value: s.extraSideRate,
        format: 'percent',
        kind: 'total',
      },
    );
  }

  rows.push(
    heading('nStep3', `Step ${hasSide ? 3 : 2}: add the Pre-tax account's withdrawal to that stack and re-do the tax`),
    money('nW', 'Pre-tax account withdrawal (4% of its projected value)', s.accountWithdrawal),
    money(
      'nTaxableSS',
      'Taxable part of Social Security, with the withdrawal',
      st.preTaxWorld.taxableSS,
      'sub',
      `${$(st.preTaxWorldBeforeAccount.taxableSS)} without it`,
    ),
    money('nTaxWith', 'Total tax with the withdrawal', st.preTaxWorld.totalTax),
    money('nTaxWithout', 'Total tax without it', st.preTaxWorldBeforeAccount.totalTax),
    money(
      'nExtraTax',
      'Extra tax caused by the withdrawal',
      s.extraTaxFromAccount,
      'sub',
      `${$(st.preTaxWorld.totalTax)} − ${$(st.preTaxWorldBeforeAccount.totalTax)}`,
    ),
    {
      key: 'nEffective',
      label: 'Effective rate on the account withdrawal',
      detail: `${$(s.extraTaxFromAccount)} ÷ ${$(s.accountWithdrawal)}`,
      value: s.effectiveRate,
      format: 'percent',
      kind: 'total',
    },

    heading('nStep4', `Step ${hasSide ? 4 : 3}: put the two together`),
    money('nRothW', 'Roth account withdrawal (tax-free)', s.rothAccountWithdrawal),
    money('nMore', 'How much more the Pre-tax account delivers, before tax', s.accountWithdrawal - s.rothAccountWithdrawal),
    ...(hasSide
      ? [
          money(
            'nExtraValue',
            'After-tax value of the extra taxable money',
            s.extraSide.withdrawal * (1 - s.extraSideRate),
            'sub',
            `${$(s.extraSide.withdrawal)} × (1 − ${pct(s.extraSideRate)})`,
          ),
        ]
      : []),
    {
      key: 'nSaved',
      label: 'Tax saved now, after any tax on investing it',
      detail: hasSide
        ? `(${$(s.accountWithdrawal)} − ${$(s.rothAccountWithdrawal)} + ${$(s.extraSide.withdrawal)} × (1 − ${pct(s.extraSideRate)})) ÷ ${$(s.accountWithdrawal)}`
        : `(${$(s.accountWithdrawal)} − ${$(s.rothAccountWithdrawal)}) ÷ ${$(s.accountWithdrawal)}`,
      value: s.taxSavedNow,
      format: 'percent',
      kind: 'total',
    },
    { key: 'nGap', label: 'Minus the effective rate on the account withdrawal', value: s.gap, format: 'percent', kind: 'sub' },
    money(
      'nDollars',
      'Pre-tax minus Roth, after-tax income per year (negative = Roth ahead)',
      s.dollarDifference,
      'total',
      `${pct(s.gap)} × ${$(s.accountWithdrawal)}`,
    ),
  );
  return rows;
}
