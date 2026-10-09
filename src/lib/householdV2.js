// The version 2 household (round 2 phase 0): version 2 form values (householdValues.js) -> the
// household object every calculator reads. Pure.
//
//   values (v2) -> toHouseholdV2(values, year) -> household -> householdToCompareInputs, ... (household.js)
//
// The household object keeps every field version 1 has (household.js), worked out from the rows,
// so the calculators read it unchanged; it adds the rows themselves and the new person fields:
//   version: 2
//   people[i] += { birthDate, ageEntry, sex, planToAge, socialSecurity: { mode, pia } }
//                                          // from the person's Social Security row; mode 'pia': the
//                                          // benefit is worked out from the PIA (socialSecurity.js
//                                          // benefitFromPIA), spousal top-up included. No row: a PIA of 0
//   incomes: [{ id, owner, type, treatment, amount, fromAge, toAge }]       // numbers; ages null when blank
//   pensions: [{ owner, monthly, startAge, cola, survivorShare }]            // the pension rows (pensionIncome.js)
//   contributionRows: [{ id, owner, tax, account, amount, employer }]   // employer: employerContributions.js
//   liabilities: [{ id, kind, balance, rate, payment }]
//   calculators.tax.taxExemptIncome                                         // carried, not used yet
//
// From the rows, for this year (person's age = year - birth year, the age reached this year):
//  - wages / selfEmploymentIncome: the person's W-2 / 1099 rows received at that age (a row with no
//    ages always counts, as version 1's income did).
//  - calculators.tax: the other income received this year, whoever's it is, and this year's
//    pensions (Social Security this year comes from each person's benefit: taxCalculator.js).
//  - calculators.pension: the first pension row with the lump-sum offer (null without one).
//  - calculators.projection.endAge: person 1's age in the year the last person reaches their
//    plan-to age (the projection runs that long).
//  - futureContributions: each person's Roth and Pre-tax rows (one type and one account type per
//    person for now; taxable rows are kept but aren't Roth vs. Pre-tax, so they're left out).
// Rows owned by a spouse who isn't included are left out, as version 1 left out the spouse's
// income and savings; their accounts count as person 1's (as in version 1).
import { parseNumber } from './formInputs.js';
import { pensionFromValues } from './pensionCalculator.js';
import { pensionIncomeInYear } from './pensionIncome.js';
import { activePeople, isLegacyV2, migrateLegacyV2, parseBirthDate } from './householdValues.js';
import { validateHousehold } from './household.js';

const blankAsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));
const blankAsNull = (text) => (String(text ?? '').trim() === '' ? null : parseNumber(text));

// Whether a row is received at this age (blank ages: no limit on that side).
export function receivedAt(row, age) {
  if (row.fromAge !== null && !(age >= row.fromAge)) return false;
  if (row.toAge !== null && !(age <= row.toAge)) return false;
  return true;
}

function birthYearOf(person, year) {
  const date = person.ageEntry === 'birthdate' ? parseBirthDate(person.birthDate) : null;
  return date ? date.year : year - parseNumber(person.age);
}

export function toHouseholdV2(input, year) {
  const values = isLegacyV2(input) ? migrateLegacyV2(input, year) : input;
  const included = activePeople(values);
  const ids = new Set(included.map((p) => p.id));
  const incomes = values.incomes
    .filter((r) => ids.has(r.owner))
    .map((r) => ({
      id: r.id,
      owner: r.owner,
      type: r.type,
      treatment: r.type === 'other' ? r.treatment : 'ordinary',
      amount: blankAsZero(r.amount),
      fromAge: blankAsNull(r.fromAge),
      toAge: blankAsNull(r.toAge),
      ...(r.type === 'socialSecurity' && { ssMode: r.ssMode === 'pia' ? 'pia' : 'estimate' }),
      ...(r.type === 'pension' && { cola: Number(r.cola ?? 0) || 0, survivorShare: Number(r.survivorShare ?? 0) || 0 }),
    }));
  const pensions = incomes
    .filter((r) => r.type === 'pension')
    .map((r) => ({ owner: r.owner, monthly: r.amount, startAge: r.fromAge, cola: r.cola, survivorShare: r.survivorShare }));
  const contributionRows = values.contributions
    .filter((r) => ids.has(r.owner))
    .map((r) => ({
      id: r.id,
      owner: r.owner,
      tax: r.tax,
      account: r.account,
      amount: blankAsZero(r.amount),
      // the employer's 401(k) contribution (employerContributions.js); a save from before it: none
      employer:
        r.employer === 'match'
          ? { type: 'match', matchRate: Number(r.matchRate) || 0, matchUpTo: Number(r.matchUpTo) || 0 }
          : r.employer === 'flat'
            ? { type: 'flat', amount: blankAsZero(r.employerAmount) }
            : { type: 'none' },
    }));

  const people = included.map((p) => {
    const birthYear = birthYearOf(p, year);
    const age = year - birthYear;
    const earned = (type) =>
      incomes.filter((r) => r.owner === p.id && r.type === type && receivedAt(r, age)).reduce((a, r) => a + r.amount, 0);
    const ss = incomes.find((r) => r.owner === p.id && r.type === 'socialSecurity');
    // The PIA as typed (blank = not entered: an error when "enter the PIA" is chosen).
    const piaTyped = ss && parseNumber(values.incomes.find((r) => r.id === ss.id)?.amount);
    return {
      id: p.id,
      birthYear,
      birthDate: p.ageEntry === 'birthdate' ? p.birthDate : '',
      ageEntry: p.ageEntry,
      sex: p.sex,
      retirementAge: parseNumber(p.retirementAge),
      planToAge: blankAsNull(p.planToAge),
      wages: earned('w2'),
      selfEmploymentIncome: earned('1099'),
      // No Social Security row: no benefit of their own (a PIA of 0); a spousal top-up can still come.
      socialSecurity: {
        mode: ss ? ss.ssMode : 'pia',
        pia: ss ? (ss.ssMode === 'pia' ? piaTyped : null) : 0,
        known: false, // version 1's "known annual benefit"; version 2 enters a PIA instead
        benefit: NaN,
        claimAge: ss ? ss.fromAge : null,
      },
    };
  });

  // This year's other income, for the tax and conversion calculators.
  const thisYear = (kind) =>
    incomes
      .filter((r) => r.type === 'other' && r.treatment === kind)
      .filter((r) => receivedAt(r, year - people.find((p) => p.id === r.owner).birthYear))
      .reduce((a, r) => a + r.amount, 0);
  const a = values.assumptions;
  const pensionsThisYear = pensionIncomeInYear({ year, people, pensions, assumptions: { inflationRate: Number(a.inflationRate) || 0 } }, 0);
  // The projection runs until the last person reaches their plan-to age (blank: 95), as person 1's age.
  const lastYear = Math.max(...people.map((p) => p.birthYear + (p.planToAge ?? 95)));

  // Future Contributions: one entry per person (amount 0 with no rows), as version 1.
  const rothOrPretax = contributionRows.filter((r) => r.tax === 'pretax' || r.tax === 'roth');
  const firstOf = (owner) => rothOrPretax.find((r) => r.owner === owner);
  const household1 = firstOf('p1');
  const currentType = household1?.tax ?? 'pretax';
  const accountType = household1?.account ?? '401k';
  const contributions = people.map((p) => {
    const own = rothOrPretax.filter((r) => r.owner === p.id);
    const first = own[0];
    return {
      owner: p.id,
      amount: own.reduce((a, r) => a + r.amount, 0),
      // A person's own type and account type, when not the household's (person 1's).
      ...(first && first.tax !== currentType && { currentType: first.tax }),
      ...(first && first.account !== accountType && { accountType: first.account }),
    };
  });

  const proj = values.calculators.projection;
  const firstPension = pensions[0];
  return {
    version: 2,
    year,
    filingStatus: values.filingStatus,
    people,
    accounts: values.accounts.map((acc) => ({
      id: acc.id,
      owner: ids.has(acc.owner) ? acc.owner : 'p1',
      type: acc.type,
      balance: blankAsZero(acc.balance),
      ...(acc.type === 'taxable' && { basisShare: Number(acc.basisShare ?? 0.5) }),
      // its own dividend yield (blank: the assumption; taxCalculator.js taxableAccountDividends)
      ...(acc.type === 'taxable' && String(acc.dividendYield ?? '').trim() !== '' && { dividendYield: Number(acc.dividendYield) }),
    })),
    incomes,
    pensions,
    contributionRows,
    liabilities: values.liabilities.map((l) => ({
      id: l.id,
      kind: l.kind,
      balance: blankAsZero(l.balance),
      rate: blankAsZero(l.rate),
      payment: blankAsZero(l.payment),
    })),
    futureContributions: { currentType, accountType, contributions },
    deductions: { itemized: blankAsZero(values.deductions?.itemized) },
    // Children with their age this year (the age reached this calendar year); other dependents.
    dependents: (values.dependents ?? []).map((d) => ({ kind: d.kind, age: d.kind === 'child' ? blankAsNull(d.age) : null })),
    spending: {
      debtPaymentsEnding: blankAsZero(values.spending.debtPayments),
      otherExpensesEnding: blankAsZero(values.spending.otherExpenses),
      retirementLifestyle: Number(values.spending.retirementLifestyle),
    },
    calculators: {
      tax: {
        ordinaryIncome: thisYear('ordinary') + pensionsThisYear,
        investmentOrdinaryIncome: thisYear('interest'),
        preferentialIncome: thisYear('qualified'),
        taxExemptIncome: thisYear('taxExempt'),
      },
      conversion: { amount: blankAsZero(values.calculators.conversion.amount) },
      pension: firstPension
        ? {
            owner: firstPension.owner,
            ...pensionFromValues({
              penLumpSum: values.calculators.pension?.lumpSum,
              penMonthly: String(firstPension.monthly),
              penStartAge: firstPension.startAge === null ? '' : String(firstPension.startAge),
              penCola: String(firstPension.cola),
              penSurvivor: String(firstPension.survivorShare),
            }),
          }
        : null,
      projection: {
        // (an age not entered yet: person 1's own plan-to age; the age shows its own error)
        endAge: Number.isFinite(lastYear - people[0].birthYear) ? lastYear - people[0].birthYear : (people[0].planToAge ?? 95),
        heirTaxRate: Number(proj.heirTaxRate),
        strategy: proj.strategy,
      },
    },
    assumptions: {
      returnRate: Number(a.returnRate),
      // The return once no one works (phase 2; projection.js): 'same' (or blank) = returnRate.
      retirementReturnRate:
        a.retirementReturnRate === 'same' || String(a.retirementReturnRate ?? '').trim() === '' ? Number(a.returnRate) : Number(a.retirementReturnRate),
      inflationRate: Number(a.inflationRate),
      ageDeductions: a.ageDeductions === 'yes',
      taxSavedAcrossContribution: a.taxSavedBasis === 'average',
      retirementRateShift: Number(a.retirementRateShift ?? 0) || 0,
      medicareIrmaa: a.medicareIrmaa === 'yes',
      survivorSpending: Number.isFinite(Number(a.survivorSpending)) && String(a.survivorSpending).trim() !== '' ? Number(a.survivorSpending) : 0.8,
      // Tax drag (phase 2): the qualified dividends a taxable account pays a year (projection.js, compare.js).
      dividendYield: Number(a.dividendYield) >= 0 && String(a.dividendYield ?? '').trim() !== '' ? Number(a.dividendYield) : 0.013,
      // The QBI deduction on 1099 earnings (qbi.js, basic rule): always, in version 2 (round 2
      // phase 1). Version 1 households (household.js) leave it out, as the current calculator does.
      qualifiedBusinessIncome: true,
      // The Roth comparison's snapshot at the LAST person's retirement, each person contributing
      // until their own (decided 2026-10-07/08; version 1 households: the first).
      snapshotAtLastRetirement: true,
    },
  };
}

// version 1's checks (household.js validateHousehold), plus the version 2 rows and person fields.
export function validateHouseholdV2(household) {
  const errors = validateHousehold(household);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const whose = (id) => (id === 'p1' ? 'your' : "your spouse's");
  for (const p of household.people) {
    if (p.ageEntry === 'birthdate' && !parseBirthDate(p.birthDate)) errors.push(`Enter ${whose(p.id)} birthdate as a full date.`);
    if (p.socialSecurity.mode === 'pia' && (!isNum(p.socialSecurity.pia) || p.socialSecurity.pia < 0)) {
      errors.push(`Enter ${whose(p.id)} monthly Social Security benefit at full retirement age (PIA).`);
    }
    if (p.planToAge !== null && (!isNum(p.planToAge) || p.planToAge > 120)) errors.push(`Choose ${whose(p.id)} plan-to age (up to 120).`);
  }
  for (const p of household.people) {
    if (household.incomes.filter((r) => r.owner === p.id && r.type === 'socialSecurity').length > 1) {
      errors.push(`Enter one Social Security row for ${p.id === 'p1' ? 'you' : 'your spouse'}.`);
    }
  }
  for (const r of household.incomes) {
    if (r.type === 'pension' && !isNum(r.fromAge)) errors.push("Enter each pension's start age.");
    if (r.type === 'pension' && !(r.cola >= 0 && r.cola <= 0.1)) errors.push("A pension's yearly increase is 0% to 10%.");
    if (!isNum(r.amount) || r.amount < 0) errors.push("Income amounts can't be negative.");
    if ((r.fromAge !== null && !isNum(r.fromAge)) || (r.toAge !== null && !isNum(r.toAge))) errors.push('Enter income ages as whole numbers.');
    else if (r.fromAge !== null && r.toAge !== null && r.toAge < r.fromAge) errors.push("An income's last age can't be before its first.");
  }
  for (const r of household.contributionRows) {
    if (!isNum(r.amount) || r.amount < 0) errors.push("Contributions can't be negative.");
  }
  // The Roth comparison takes one Roth/Pre-tax type and one account type per person for now.
  for (const p of household.people) {
    const own = household.contributionRows.filter((r) => r.owner === p.id && r.tax !== 'taxable');
    if (new Set(own.map((r) => r.tax)).size > 1 || new Set(own.map((r) => r.account)).size > 1) {
      errors.push(`For now, ${whose(p.id)} contributions need one type (Roth or Pre-tax) and one account type.`);
    }
  }
  if (!isNum(household.deductions.itemized) || household.deductions.itemized < 0) errors.push("Itemized deductions can't be negative.");
  for (const d of household.dependents) {
    if (d.kind === 'child' && !(isNum(d.age) && d.age >= 0 && d.age <= 30)) errors.push("Enter each child's age (0 to 30).");
  }
  for (const l of household.liabilities) {
    if (![l.balance, l.rate, l.payment].every((n) => isNum(n) && n >= 0)) errors.push("Debts' balances, rates and payments can't be negative.");
  }
  return [...new Set(errors)];
}

