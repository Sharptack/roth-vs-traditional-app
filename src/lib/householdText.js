// A plain-text summary of a household and its results (the preview's "Copy summary"), for pasting
// into a conversation or an email: every input, each calculator's headline, and the link. Pure.
// The current calculator's own version is shareInputs.js's shareText (flat inputs).
import { ACCOUNT_TYPES, FILING_STATUSES } from './constants.js';
import { formatCurrency, formatPercent } from './format.js';
import { everyoneRetired } from './spendingNeed.js';

const TYPE = { pretax: 'Pre-tax', roth: 'Roth', taxable: 'Taxable' };
const bullet = (label, value) => `- ${label}: ${value}`;

function personLines(p, year, label) {
  const income = [
    p.wages > 0 && `${formatCurrency(p.wages)} W-2`,
    p.selfEmploymentIncome > 0 && `${formatCurrency(p.selfEmploymentIncome)} 1099`,
  ].filter(Boolean);
  const ss = p.socialSecurity.mode === 'receiving'
    ? `${formatCurrency(p.socialSecurity.benefit / 12)} per month, received now`
    : p.socialSecurity.known
    ? `${formatCurrency(p.socialSecurity.benefit)} per year (entered)`
    : p.socialSecurity.mode === 'pia'
      ? `${formatCurrency(p.socialSecurity.pia)} per month at full retirement age (PIA, entered)`
      : 'estimated from earnings';
  const claim = p.socialSecurity.mode === 'receiving' ? '' : p.socialSecurity.claimAge ? `, claimed at ${p.socialSecurity.claimAge}` : ', claimed at retirement';
  const age = year - p.birthYear;
  // A blank retirement age (not entered) or one at or below the age now (already retired, 2026-10-09).
  const retires = !Number.isFinite(p.retirementAge) ? 'retirement age not entered' : p.retirementAge <= age ? `retired at ${p.retirementAge}` : `retires at ${p.retirementAge}`;
  const life = Number.isFinite(p.planToAge) ? `, life expectancy ${p.planToAge}` : '';
  return [
    bullet(label, `age ${age}, ${retires}${life}`),
    bullet(`${label}, income`, income.length > 0 ? income.join(' + ') : '$0'),
    bullet(`${label}, Social Security`, ss + claim),
  ];
}

// The household's inputs as labelled lines.
export function describeHousehold(household) {
  const { year, people, accounts, futureContributions: fc, spending, assumptions } = household;
  const names = ['You', 'Spouse'];
  const lines = [bullet('Filing status', FILING_STATUSES[household.filingStatus] ?? household.filingStatus)];
  people.forEach((p, i) => lines.push(...personLines(p, year, names[i])));
  fc.contributions.forEach((c) => {
    const i = people.findIndex((p) => p.id === c.owner);
    lines.push(
      bullet(
        `Future Contributions, ${names[i].toLowerCase()}`,
        `${formatCurrency(c.amount)} per year, ${TYPE[c.currentType ?? fc.currentType]}, ${ACCOUNT_TYPES[c.accountType ?? fc.accountType]}`,
      ),
    );
  });
  const held = accounts.filter((a) => a.balance > 0);
  if (held.length === 0) lines.push(bullet('Existing Accounts', 'none'));
  for (const a of held) {
    const who = people.length > 1 ? `${names[people.findIndex((p) => p.id === a.owner)].toLowerCase()}, ` : '';
    const basis = a.type === 'taxable' ? `, ${formatPercent(a.basisShare ?? 0, 0)} cost basis` : '';
    lines.push(bullet('Existing Account', `${who}${TYPE[a.type]} ${formatCurrency(a.balance)}${basis}`));
  }
  // The budget method (phase 3, spendingNeed.js); retired households always use it.
  if (spending.method === 'budget' || everyoneRetired(household)) {
    lines.push(bullet('Retirement spending based on', spending.baselineExpenses == null ? 'the budget (not entered)' : `the budget, ${formatCurrency(spending.baselineExpenses)} per year`));
  }
  lines.push(
    bullet('Costs ending before retirement', `${formatCurrency(spending.debtPaymentsEnding)} debt, ${formatCurrency(spending.otherExpensesEnding)} other, per year`),
    bullet('Retirement lifestyle', `${formatPercent(spending.retirementLifestyle, 0)} of today's spending`),
    bullet('Return after inflation', formatPercent(assumptions.returnRate, 0)),
    ...(assumptions.retirementReturnRate !== undefined && assumptions.retirementReturnRate !== assumptions.returnRate
      ? [bullet('Return in retirement', formatPercent(assumptions.retirementReturnRate, 0))]
      : []),
    bullet('Inflation (fixed-dollar thresholds)', formatPercent(assumptions.inflationRate ?? 0, 1)),
    bullet('Age 65+ deductions in retirement', assumptions.ageDeductions ? 'included' : 'left out'),
    bullet('Medicare IRMAA surcharges', assumptions.medicareIrmaa ? 'included' : 'left out'),
    bullet('Tax saved now', assumptions.taxSavedAcrossContribution ? 'across the whole contribution' : 'at the marginal rate'),
    ...(assumptions.retirementRateShift
      ? [bullet('Tax rates in retirement (what-if)', `${assumptions.retirementRateShift > 0 ? '+' : '−'}${Math.abs(Math.round(assumptions.retirementRateShift * 100))} points`)]
      : []),
  );
  return lines;
}

// tiles: [{ title, headline, detail }], one per calculator (lib/suiteTiles.js).
export function householdShareText({ household, tiles, url }) {
  return [
    `Client household (${household.year} tax rules)`,
    `Link: ${url}`,
    '',
    'Inputs',
    ...describeHousehold(household),
    '',
    'Results',
    ...tiles.map((t) => `- ${t.title}: ${t.headline} (${t.detail})`),
  ].join('\n');
}
