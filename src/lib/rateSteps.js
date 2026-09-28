// The "How are these rates calculated?" walk-through as plain data, so the one-scenario
// dropdown and the side-by-side scenario comparison show exactly the same steps, and so the
// SAME renderer works for the main (with Social Security) and "Retirement years without
// Social Security" scenarios — both produce a `sideAware` object (sideAwareRates.js) and this
// module turns either one into rows. Pure: no new financial logic.
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

// The rates walk-through, from a `sideAware` object (sideAwareRates.js) plus the
// `socialSecurity`/`otherWithdrawals` it was built from. Empty when there is no account
// withdrawal to measure (e.g. $0 saved).
//
// Three steps: income from elsewhere -> the difference that matters -> add in the
// withdrawal from Future Contributions. The taxable account each scenario's Future
// Contributions build (once savings exceed the IRS limit) lives in Step 2, "the
// difference": it's what makes the two scenarios' pictures differ before the account
// withdrawal is even added; Step 2 is always shown (a plain note when nothing exceeds the
// limit), so the step count never changes, only its content. A final, unnumbered "Putting
// the two rates together" line assembles the two rates into the dollar comparison — there
// is no walk-through for the marginal-rate side of that comparison because, when nothing
// exceeds the limit, it's simply your marginal rate, stated rather than derived.
export function sideAwareRateSteps({ sideAware: s, socialSecurity, otherWithdrawals: o }) {
  if (!s.available) return [];
  const st = s.stacks;
  const hasSide = s.pretaxSide.withdrawal > 0.5 || s.rothSide.withdrawal > 0.5;
  const hasExistingGains = o.taxableGross > 0;
  const pct = (v) => formatPercent(v);

  const rows = [
    heading('step1', 'Step 1: income from Social Security and Existing Accounts'),
    money('ssBenefit', 'Social Security benefit', socialSecurity.annualBenefit),
    money('otherPretax', 'Existing Accounts, Pre-tax (4% withdrawal)', o.pretaxGross),
    ...(hasExistingGains
      ? [
          money('otherTaxable', 'Existing Accounts, taxable (4% withdrawal)', o.taxableGross),
          money('otherGains', '…of which gains (taxed; the rest is cost basis)', o.taxableGains),
        ]
      : []),
    money('existingTax', 'Tax on that income', st.existing.totalTax, 'total'),

    heading('step2', "Step 2: the difference — the taxable account each scenario's Future Contributions build"),
  ];

  if (hasSide) {
    rows.push(
      money('rothSide', "Roth scenario's taxable account (4% withdrawal)", s.rothSide.withdrawal, 'sub', `${$(s.rothSide.gains)} of it gains`),
      money('pretaxSide', "Pre-tax scenario's taxable account (4% withdrawal)", s.pretaxSide.withdrawal, 'sub', `${$(s.pretaxSide.gains)} of it gains`),
      money(
        'extraSide',
        'Extra taxable money the Pre-tax scenario holds (the tax its deduction saved, invested)',
        s.extraSide.withdrawal,
        'sub',
        `${$(s.pretaxSide.withdrawal)} − ${$(s.rothSide.withdrawal)}`,
      ),
      money('taxRothSide', "Tax with the Roth scenario's taxable account added", st.rothWorld.totalTax),
      money('taxPretaxSide', "Tax with the Pre-tax scenario's taxable account added", st.preTaxWorldBeforeAccount.totalTax),
      money(
        'extraSideTax',
        'Extra tax on that extra money',
        s.extraSideTax,
        'sub',
        `${$(st.preTaxWorldBeforeAccount.totalTax)} − ${$(st.rothWorld.totalTax)}`,
      ),
      {
        key: 'extraSideRate',
        label: 'Tax rate on the extra taxable money',
        detail: `${$(s.extraSideTax)} ÷ ${$(s.extraSide.withdrawal)}`,
        value: s.extraSideRate,
        format: 'percent',
        kind: 'total',
      },
    );
  } else {
    rows.push({
      key: 'noSide',
      label:
        "None of your Future Contributions exceed the IRS limit, so neither scenario has a taxable account here — nothing to add in this step",
      kind: 'sub',
    });
  }

  rows.push(
    heading('step3', "Step 3: add the Pre-tax account's own withdrawal and re-do the tax"),
    money('w', 'Pre-tax account withdrawal (4% of its projected value)', s.accountWithdrawal),
    money(
      'taxableSS',
      'Taxable part of Social Security, with the withdrawal',
      st.preTaxWorld.taxableSS,
      'sub',
      `${$(st.preTaxWorldBeforeAccount.taxableSS)} without it`,
    ),
    money('taxWith', 'Total tax with the withdrawal', st.preTaxWorld.totalTax),
    money('taxWithout', 'Total tax without it', st.preTaxWorldBeforeAccount.totalTax),
    money(
      'extraTax',
      'Extra tax caused by the withdrawal',
      s.extraTaxFromAccount,
      'sub',
      `${$(st.preTaxWorld.totalTax)} − ${$(st.preTaxWorldBeforeAccount.totalTax)}`,
    ),
    {
      key: 'effective',
      label: 'Effective rate on the account withdrawal',
      detail: `${$(s.extraTaxFromAccount)} ÷ ${$(s.accountWithdrawal)}`,
      value: s.effectiveRate,
      format: 'percent',
      kind: 'total',
    },

    heading('final', 'Putting the two rates together'),
    money('rothW', 'Roth account withdrawal (tax-free)', s.rothAccountWithdrawal),
    ...(hasSide
      ? [
          money(
            'extraValue',
            'After-tax value of the extra taxable money',
            s.extraSide.withdrawal * (1 - s.extraSideRate),
            'sub',
            `${$(s.extraSide.withdrawal)} × (1 − ${pct(s.extraSideRate)})`,
          ),
        ]
      : []),
    {
      key: 'saved',
      label: 'Tax saved now, after any tax on investing it',
      detail: hasSide
        ? `(${$(s.accountWithdrawal)} − ${$(s.rothAccountWithdrawal)} + ${$(s.extraSide.withdrawal)} × (1 − ${pct(s.extraSideRate)})) ÷ ${$(s.accountWithdrawal)}`
        : `(${$(s.accountWithdrawal)} − ${$(s.rothAccountWithdrawal)}) ÷ ${$(s.accountWithdrawal)}`,
      value: s.taxSavedNow,
      format: 'percent',
      kind: 'total',
    },
    { key: 'gap', label: 'Minus the effective rate on the account withdrawal', value: s.gap, format: 'percent', kind: 'sub' },
    money(
      'dollars',
      'Pre-tax minus Roth, after-tax income per year (negative = Roth ahead)',
      s.dollarDifference,
      'total',
      `${pct(s.gap)} × ${$(s.accountWithdrawal)}`,
    ),
  );
  return rows;
}
