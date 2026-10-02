// A plain-text summary of a household and its results (the preview's "Copy summary"), for pasting
// into a conversation or an email: every input, each calculator's headline, and the link. Pure.
// The current calculator's own version is shareInputs.js's shareText (flat inputs).
import { ACCOUNT_TYPES, FILING_STATUSES } from './constants.js';
import { formatCurrency, formatPercent } from './format.js';

const TYPE = { pretax: 'Pre-tax', roth: 'Roth', taxable: 'Taxable' };
const bullet = (label, value) => `- ${label}: ${value}`;

function personLines(p, year, label) {
  const income = [
    p.wages > 0 && `${formatCurrency(p.wages)} W-2`,
    p.selfEmploymentIncome > 0 && `${formatCurrency(p.selfEmploymentIncome)} 1099`,
  ].filter(Boolean);
  const ss = p.socialSecurity.known ? `${formatCurrency(p.socialSecurity.benefit)} a year (entered)` : 'estimated';
  const claim = p.socialSecurity.claimAge ? `, claimed at ${p.socialSecurity.claimAge}` : ', claimed at retirement';
  return [
    bullet(label, `age ${year - p.birthYear}, retires at ${p.retirementAge}`),
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
        `${formatCurrency(c.amount)} a year, ${TYPE[c.currentType ?? fc.currentType]}, ${ACCOUNT_TYPES[c.accountType ?? fc.accountType]}`,
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
  lines.push(
    bullet('Costs ending before retirement', `${formatCurrency(spending.debtPaymentsEnding)} debt, ${formatCurrency(spending.otherExpensesEnding)} other, a year`),
    bullet('Retirement lifestyle', `${formatPercent(spending.retirementLifestyle, 0)} of today's spending`),
    bullet('Return after inflation', formatPercent(assumptions.returnRate, 0)),
    bullet('Inflation (fixed-dollar thresholds)', formatPercent(assumptions.inflationRate ?? 0, 1)),
    bullet('Age 65+ deductions in retirement', assumptions.ageDeductions ? 'included' : 'left out'),
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
