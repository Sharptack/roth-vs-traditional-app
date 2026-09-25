// Scenario batches for the "Visualization" page (#/scenarios). Each batch sweeps
// one variable while holding the rest fixed, feeding compareRothVsTraditional
// (via src/lib/scenarios.js) so the page can chart how the rate gap — marginal
// rate now minus the effective rate on this account's withdrawals in retirement —
// behaves as that variable moves. The idea being tested: a bigger (more positive)
// gap should favor Pre-tax; a bigger negative gap should favor Roth.
//
// Shared, unstated assumptions across every batch: single filer, all W-2 income,
// no self-employment income, 0 debt payments, 0 other expenses ending at
// retirement, 7% expected return, Social Security estimated (not user-entered),
// same 1× retirement lifestyle unless a batch is explicitly sweeping it, and a
// 401(k) account (the contribution-limit check never binds at these income/
// savings-rate combinations, so the account type choice doesn't matter here).

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
};

export const INCOMES = [
  40000, 50000, 60000, 75000, 90000, 100000, 125000, 150000, 175000, 200000, 250000, 300000,
];

// Retirement lifestyle multipliers, 1x (same as today) to 2x in 0.1 steps.
export const LIFESTYLES = Array.from({ length: 11 }, (_, i) => Number((1 + i / 10).toFixed(1)));

const bySavingsRate = (income, rate) => ({
  grossIncome: income,
  savings: Math.round(income * rate),
});

const formatBalanceLabel = (balance) => {
  if (balance === 0) return 'No existing balance';
  const compact = balance >= 1000000 ? `$${(balance / 1000000).toFixed(1)}M` : `$${(balance / 1000).toFixed(0)}k`;
  return `${compact} existing balance`;
};

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
    description: 'Same as above (age 35, retiring at 65), compared at 5%, 10%, and 20% savings rates.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [0.05, 0.1, 0.2].map((rate) => ({
      key: `savings${Math.round(rate * 100)}`,
      label: `${Math.round(rate * 100)}% savings rate`,
      points: INCOMES.map((income) => ({ x: income, overrides: bySavingsRate(income, rate) })),
    })),
  },
  {
    key: 'balanceSweep',
    title: 'Income, with different existing Pre-tax balances (age 35)',
    description:
      'Same as the first chart (age 35, retiring at 65, saving 10%), but starting with an existing Pre-tax balance of $0, $20,000, $100,000, or $250,000 today.',
    xLabel: 'Gross income',
    xType: 'currency',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [0, 20000, 100000, 250000].map((balance) => ({
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
    key: 'lifestyleSweep',
    title: 'Spending more in retirement, at different incomes',
    description:
      'Age 35, retiring at 65, saving 10% of gross income, no debt or other expenses ending at retirement, no other balances — retirement lifestyle scaled from 1× (same as today) up to 2× (100% higher).',
    xLabel: 'Retirement lifestyle vs. today',
    xType: 'multiple',
    base: { ...BASE, currentAge: 35, retirementAge: 65 },
    series: [30000, 50000, 75000, 100000, 150000].map((income) => ({
      key: `income${income}`,
      label: `$${(income / 1000).toFixed(0)}k income`,
      points: LIFESTYLES.map((lifestyle) => ({
        x: lifestyle,
        overrides: { ...bySavingsRate(income, 0.1), retirementLifestyle: lifestyle },
      })),
    })),
  },
];
