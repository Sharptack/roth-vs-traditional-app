// Scenario batches for the "Visualization" page (#/scenarios). Each batch sweeps
// one variable while holding the rest fixed, feeding compareRothVsTraditional
// (via src/lib/scenarios.js) so the page can chart who comes out ahead as that
// variable moves. The winner follows the sign of the rate gap exactly (gap x W is the
// dollar difference, see sideAwareRates.js), so the charts show where and why the
// gap changes sign, not whether it predicts the winner.
//
// Shared, unstated assumptions across every batch: single filer, all W-2 income,
// no self-employment income, 0 debt payments, 0 other expenses ending at
// retirement, 7% expected return, Social Security estimated (not user-entered),
// same 1× retirement lifestyle unless a batch is explicitly sweeping it, and a
// 401(k) account. The IRS limit DOES bind at higher incomes and savings rates (2026:
// 114 of 467 points, e.g. 10% of $300k = $30,000 vs. a $24,500 limit): the calculator
// then puts the rest of the same take-home cost in a taxable account, so the Roth-
// advantage numbers at those points include that taxable side.

const BASE = {
  filingStatus: 'single',
  selfEmploymentIncome: 0,
  debtPayments: 0,
  otherExpenses: 0,
  currentType: 'pretax',
  accountType: '401k',
  knowsSocialSecurity: false,
  socialSecurityBenefit: 0,
  returnRate: 0.07,
  retirementLifestyle: 1,
  otherPretaxBalance: 0,
  otherRothBalance: 0,
  otherTaxableBalance: 0,
  otherTaxableBasis: 0.5, // the calculator's default: half of an existing taxable balance is cost basis
};

export const INCOMES = [
  25000, 40000, 50000, 60000, 75000, 90000, 100000, 125000, 150000, 175000, 200000, 250000, 300000, 500000,
];

// Retirement lifestyle multipliers, 1x (same as today) to 2x in 0.1 steps.
export const LIFESTYLES = Array.from({ length: 11 }, (_, i) => Number((1 + i / 10).toFixed(1)));

export const bySavingsRate = (income, rate) => ({
  grossIncome: income,
  savings: Math.round(income * rate),
});

const compactMoney = (v) => (v >= 1000000 ? '$' + Number((v / 1000000).toFixed(1)) + 'M' : '$' + (v / 1000).toFixed(0) + 'k');

const formatBalanceLabel = (balance) =>
  balance === 0 ? 'No existing balance' : `${compactMoney(balance)} existing balance`;

// Existing balances swept on the x axis of the balance-level batches.
export const PRETAX_BALANCES = [0, 50000, 100000, 250000, 500000, 750000, 1000000, 1500000, 2000000];
export const TAXABLE_BALANCES = [0, 50000, 100000, 250000, 500000, 750000, 1000000];

// Future incomes swept by the "earning more later" batches (x axis), and their shared setup.
// These run through risingIncome.js (`engine: 'risingIncome'`), not compare.js: the decision is
// the contributions made during the 10 years at today's income; the 30 years at the later income
// are saved too and sit under them in the retirement tax stack, and Social Security reflects the
// whole earnings path.
export const FUTURE_INCOMES = [
  20000, 25000, 40000, 50000, 60000, 75000, 100000, 125000, 150000, 200000, 250000, 300000, 500000,
];
const RISING_BASE = {
  filingStatus: 'single',
  accountType: '401k',
  currentAge: 25,
  raiseAge: 35,
  retirementAge: 65,
  savingsRate: 0.1,
  returnRate: 0.07,
};

// Retirement ages swept by the retirement-age batch (35 is the current age there).
export const RETIREMENT_AGES = Array.from({ length: 16 }, (_, i) => 55 + i);

export const SCENARIO_BATCHES = [
  {
    key: 'incomeSweep',
    title: 'Income, at a fixed 10% savings rate',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, no debt or other expenses ending at retirement, no other account balances.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [
      {
        key: 'savings10',
        label: '10% savings rate',
        points: INCOMES.map((income) => ({ x: income, overrides: bySavingsRate(income, 0.1) })),
      },
    ],
  },
  {
    key: 'savingsRateSweep',
    title: 'Income, at different savings rates',
    description: 'Same as above (age 35, retiring at 65), compared at 5%, 10%, 20%, and 30% savings rates.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [0.05, 0.1, 0.2, 0.3].map((rate) => ({
      key: `savings${Math.round(rate * 100)}`,
      label: `${Math.round(rate * 100)}% savings rate`,
      points: INCOMES.map((income) => ({ x: income, overrides: bySavingsRate(income, rate) })),
    })),
  },
  {
    key: 'balanceSweep',
    title: 'Income, with different existing Pre-tax balances (age 35)',
    description:
      'Same as the first chart (age 35, retiring at 65, saving 10%), but starting with an existing Pre-tax balance of $0, $20,000, $100,000, $250,000, or $500,000 today.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [0, 20000, 100000, 250000, 500000].map((balance) => ({
      key: `balance${balance}`,
      label: formatBalanceLabel(balance),
      points: INCOMES.map((income) => ({
        x: income,
        overrides: { ...bySavingsRate(income, 0.1), otherPretaxBalance: balance },
      })),
    })),
  },
  {
    key: 'age50BalanceSweep',
    title: 'Income, age 50 retiring at 65, with different existing balances',
    description:
      'Only 15 years to retirement instead of 30. Saving 10% of gross income, no debt or other expenses ending at retirement, starting with an existing Pre-tax balance of $0, $100,000, $500,000, or $1,000,000 today.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 50, retirementAge: 65 },
    series: [0, 100000, 500000, 1000000].map((balance) => ({
      key: `balance${balance}`,
      label: formatBalanceLabel(balance),
      points: INCOMES.map((income) => ({
        x: income,
        overrides: { ...bySavingsRate(income, 0.1), otherPretaxBalance: balance },
      })),
    })),
  },
  {
    key: 'age50SavingsSweep',
    title: 'Age 50: saving more, with a $500k existing Pre-tax balance',
    description:
      'Age 50, retiring at 65, with a typical $500,000 existing Pre-tax balance, saving 5%, 10%, 20%, or 30% of gross income. At 50 the IRS limit is higher (catch-up contributions: $32,500 in 2026), but the existing balance has only 15 years to grow, so it pushes retirement income into higher brackets less than it does at 35.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 50, retirementAge: 65, otherPretaxBalance: 500000 },
    series: [0.05, 0.1, 0.2, 0.3].map((rate) => ({
      key: 'savings' + Math.round(rate * 100),
      label: Math.round(rate * 100) + '% savings rate',
      points: INCOMES.map((income) => ({ x: income, overrides: bySavingsRate(income, rate) })),
    })),
  },
  {
    key: 'pretaxBalanceSweep',
    title: 'A bigger existing Pre-tax balance, at different incomes',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, with an existing Pre-tax balance (401(k)/IRA) of anywhere from $0 to $2 million today. A large Pre-tax balance already forces taxable withdrawals in retirement, which is where Roth contributions start to win.',
    xLabel: 'Existing Pre-tax balance today',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [25000, 75000, 150000, 300000, 500000].map((income) => ({
      key: `income${income}`,
      label: '$' + (income / 1000).toFixed(0) + 'k income',
      points: PRETAX_BALANCES.map((balance) => ({
        x: balance,
        overrides: { ...bySavingsRate(income, 0.1), otherPretaxBalance: balance },
      })),
    })),
  },
  {
    key: 'taxableBalanceSweep',
    title: 'A bigger existing taxable investment account, at different incomes',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, with an existing taxable brokerage balance of $0 to $1 million today (half assumed to be original contributions, the calculator\'s default). Its gains stack on top of retirement income and can push it into higher brackets.',
    xLabel: 'Existing taxable balance today',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [25000, 60000, 150000, 300000, 500000].map((income) => ({
      key: `income${income}`,
      label: '$' + (income / 1000).toFixed(0) + 'k income',
      points: TAXABLE_BALANCES.map((balance) => ({
        x: balance,
        overrides: { ...bySavingsRate(income, 0.1), otherTaxableBalance: balance },
      })),
    })),
  },
  {
    key: 'lifestyleSweep',
    title: 'Spending more in retirement, on its own, changes nothing',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, no debt or other expenses ending at retirement, no other balances — retirement lifestyle scaled from 1× (same as today) up to 2× (100% higher). The lines are flat on purpose: planning to spend more does not change what was saved, what it grows to, or the tax on withdrawing it. Roth vs. Pre-tax depends on how much taxable income you will have in retirement, not on your spending target. Spending more only changes the answer when something pays for it, such as higher earnings later (the next two charts).',
    xLabel: 'Retirement lifestyle vs. today',
    xType: 'multiple',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [25000, 50000, 75000, 150000, 500000].map((income) => ({
      key: `income${income}`,
      label: `$${(income / 1000).toFixed(0)}k income`,
      points: LIFESTYLES.map((lifestyle) => ({
        x: lifestyle,
        overrides: { ...bySavingsRate(income, 0.1), retirementLifestyle: lifestyle },
      })),
    })),
  },
  {
    key: 'risingIncomeSweep',
    engine: 'risingIncome',
    title: 'Earning more later: should the early contributions be Roth?',
    description:
      "What a higher future income actually changes is the retirement tax stack: bigger later savings and a bigger Social Security benefit. Age 25, earning $20k, $40k, or $60k today, then the income across from age 35 to retirement at 65, saving 10% of pay throughout. Charted: Roth vs. Pre-tax for the contributions made in the first 10 years. The later, bigger savings are held Pre-tax and are withdrawn in retirement too, so they sit underneath today's in the tax stack, and Social Security is estimated from the whole earnings path. (Where the later income equals today's, this still differs from the first chart: only the first 10 years are being decided, measured on top of the 30 years that follow.)",
    xLabel: 'Income from age 35',
    xType: 'currency',
    base: RISING_BASE,
    series: [20000, 40000, 60000].map((incomeNow) => ({
      key: `now${incomeNow}`,
      label: `$${incomeNow / 1000}k today`,
      points: FUTURE_INCOMES.map((incomeLater) => ({ x: incomeLater, overrides: { incomeNow, incomeLater } })),
    })),
  },
  {
    key: 'risingIncomeLaterType',
    engine: 'risingIncome',
    title: 'Earning more later: it depends on how the later savings are held',
    description:
      "Same as above for someone earning $20k today, with the savings from the higher-earning years held all Pre-tax, half and half, or all Roth. Roth now pays off only when something else, like those later Pre-tax savings, fills the low retirement brackets first. If the later savings go to Roth, Social Security alone rarely does, and today's contributions are better off Pre-tax.",
    xLabel: 'Income from age 35',
    xType: 'currency',
    base: { ...RISING_BASE, incomeNow: 20000 },
    series: [
      { key: 'laterPretax', label: 'Later savings all Pre-tax', laterRothShare: 0 },
      { key: 'laterHalf', label: 'Half and half', laterRothShare: 0.5 },
      { key: 'laterRoth', label: 'Later savings all Roth', laterRothShare: 1 },
    ].map(({ key, label, laterRothShare }) => ({
      key,
      label,
      points: FUTURE_INCOMES.map((incomeLater) => ({ x: incomeLater, overrides: { incomeLater, laterRothShare } })),
    })),
  },
  {
    key: 'retirementAgeSweep',
    title: 'Retiring earlier or later, at different incomes',
    description:
      'Age 35, saving 10% of gross income, no debt or other expenses ending at retirement, no other balances, retiring anywhere from 55 to 70. Retiring earlier means fewer years of saving and more years of retirement to fund. (The 10% early-withdrawal penalty before 59½ is not modeled, and for anyone retiring before 62 Social Security is estimated as if claimed at 62, which is why the lines are flat before then.)',
    xLabel: 'Retirement age',
    xType: 'age',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [25000, 50000, 100000, 150000, 500000].map((income) => ({
      key: `income${income}`,
      label: '$' + (income / 1000).toFixed(0) + 'k income',
      points: RETIREMENT_AGES.map((age) => ({
        x: age,
        overrides: { ...bySavingsRate(income, 0.1), retirementAge: age },
      })),
    })),
  },
];

// The break-even maps: every income x (row variable) combination, at age 35 retiring at 65, so the
// page can show where Roth or Pre-tax comes out ahead. `overridesFor(income, row)` builds each cell.
const HEATMAP_BASE = { ...BASE, currentAge: 35, retirementAge: 65 };

export const HEATMAPS = [
  {
    key: 'savingsRate',
    title: 'Where does each one win? Income against savings rate',
    description:
      'Age 35, retiring at 65, no debt or other expenses ending at retirement, no other balances. Each cell is one scenario: gross income across, share of income saved down.',
    rowHeading: 'Saved',
    incomes: INCOMES,
    rows: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((rate) => ({ label: `${Math.round(rate * 100)}%`, value: rate })),
    base: HEATMAP_BASE,
    overridesFor: (income, row) => bySavingsRate(income, row.value),
  },
  {
    key: 'pretaxBalance',
    title: 'Where does each one win? Income against existing Pre-tax balance',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, no debt or other expenses ending at retirement. Each cell is one scenario: gross income across, existing Pre-tax balance down.',
    rowHeading: 'Existing balance',
    incomes: INCOMES,
    rows: [0, 100000, 250000, 500000, 1000000, 2000000].map((balance) => ({
      label: balance === 0 ? '$0' : compactMoney(balance),
      value: balance,
    })),
    base: HEATMAP_BASE,
    overridesFor: (income, row) => ({ ...bySavingsRate(income, 0.1), otherPretaxBalance: row.value }),
  },
];
