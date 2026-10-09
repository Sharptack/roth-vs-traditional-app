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
//                                          // benefitFromPIA), spousal top-up included. No row: estimated from earnings.
//                                          // mode 'receiving': the check now x 12 as a known benefit
//   incomes: [{ id, owner, type, treatment, amount, fromAge, toAge, qbi }]  // numbers; ages null when blank;
//                                          // qbi (1099 rows): false when the business doesn't qualify for QBI
//   people[i].qbiShare                     // the share of this year's 1099 earnings that qualifies (yearTax.js)
//   pensions: [{ owner, monthly, startAge, cola, survivorShare }]            // the pension rows paid monthly
//                                          // in the plan (pensionIncome.js); a row whose lump sum the plan
//                                          // takes (election 'lumpSum', decided 2026-10-09) pays nothing:
//   rollovers: [{ owner, age, amount }]    // its lump sum rolled over to a Pre-tax IRA at the pension's
//                                          // start age (projection.js); one already due is a Pre-tax
//                                          // account today (accounts, id 'lump-<row id>')
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
import { incomeRowCounts } from './projection.js';
import { SS_MODES, activePeople, isLegacyV2, migrateLegacyV2, parseBirthDate } from './householdValues.js';
import { validateHousehold } from './household.js';

const blankAsZero = (text) => (String(text ?? '').trim() === '' ? 0 : parseNumber(text));
const blankAsNull = (text) => (String(text ?? '').trim() === '' ? null : parseNumber(text));

// Whether a row is received at this age (blank ages: no limit on that side).
export function receivedAt(row, age) {
  if (row.fromAge !== null && !(age >= row.fromAge)) return false;
  if (row.toAge !== null && !(age <= row.toAge)) return false;
  return true;
}

// Whether a row counts this year, as the projection counts it (projection.js incomeRowCounts):
// someone already retired has no earnings from a row with no last age. A blank retirement age: no limit.
const countsThisYear = (row, age, retirementAge) => receivedAt(row, age) && (!(age >= retirementAge) || incomeRowCounts(row, age, retirementAge, age));

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
      ...(r.type === '1099' && { qbi: r.qbi !== 'no' }),
      ...(r.type === 'socialSecurity' && { ssMode: SS_MODES.includes(r.ssMode) ? r.ssMode : 'estimate' }),
      ...(r.type === 'pension' && {
        cola: Number(r.cola ?? 0) || 0,
        survivorShare: Number(r.survivorShare ?? 0) || 0,
        lumpSum: blankAsZero(r.lumpSum),
        election: r.election === 'lumpSum' ? 'lumpSum' : 'monthly',
      }),
    }));
  const pensionRows = incomes.filter((r) => r.type === 'pension');
  const pensions = pensionRows
    .filter((r) => r.election !== 'lumpSum')
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
    const earned = (type, keep = () => true) =>
      incomes.filter((r) => r.owner === p.id && r.type === type && countsThisYear(r, age, parseNumber(p.retirementAge)) && keep(r)).reduce((a, r) => a + r.amount, 0);
    const selfEmployed = earned('1099');
    const ss = incomes.find((r) => r.owner === p.id && r.type === 'socialSecurity');
    // The PIA, or the monthly check now, as typed (blank = not entered: an error for those two).
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
      selfEmploymentIncome: selfEmployed,
      ...(selfEmployed > 0 && earned('1099', (r) => r.qbi) < selfEmployed && { qbiShare: earned('1099', (r) => r.qbi) / selfEmployed }),
      // No Social Security row: estimated from earnings (decided 2026-10-09; before, no benefit). A PIA
      // of $0 is no benefit of their own; a spousal top-up can still come.
      // Already receiving (decided 2026-10-09): version 1's known benefit, the check today x 12,
      // from this year on (claimAge = the age now), with no claiming adjustment. Its PIA isn't
      // known, so it gives the spouse no spousal top-up (socialSecurity.js). `received` = the monthly
      // check as typed (checked by validateHouseholdV2; a blank one counts as $0 until entered).
      socialSecurity:
        ss?.ssMode === 'receiving'
          ? { mode: 'receiving', pia: null, known: true, received: piaTyped, benefit: Number.isFinite(piaTyped) ? piaTyped * 12 : 0, claimAge: age }
          : {
              mode: ss ? ss.ssMode : 'estimate',
              pia: ss?.ssMode === 'pia' ? piaTyped : null,
              known: false, // version 1's "known annual benefit"; version 2 enters a PIA or the check received
              benefit: NaN,
              claimAge: ss ? ss.fromAge : null,
            },
    };
  });

  // This year's other income, for the tax and conversion calculators.
  const thisYear = (kind) =>
    incomes
      .filter((r) => r.type === 'other' && r.treatment === kind)
      .filter((r) => {
        const p = people.find((x) => x.id === r.owner);
        return countsThisYear(r, year - p.birthYear, p.retirementAge);
      })
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
  // Someone already retired saves nothing from this year on (the projection's rule too).
  const retiredNow = (p) => year - p.birthYear >= p.retirementAge;
  const contributions = people.map((p) => {
    const own = retiredNow(p) ? [] : rothOrPretax.filter((r) => r.owner === p.id);
    const first = own[0];
    return {
      owner: p.id,
      amount: own.reduce((a, r) => a + r.amount, 0),
      // A person's own type and account type, when not the household's (person 1's).
      ...(first && first.tax !== currentType && { currentType: first.tax }),
      ...(first && first.account !== accountType && { accountType: first.account }),
    };
  });

  // A pension whose lump sum the plan takes: rolled over at its start age, or today if that has passed.
  const ageNowOf = (owner) => year - people.find((p) => p.id === owner).birthYear;
  const lumpSums = pensionRows.filter((r) => r.election === 'lumpSum' && r.lumpSum > 0);
  const rollovers = lumpSums.filter((r) => r.fromAge > ageNowOf(r.owner)).map((r) => ({ owner: r.owner, age: r.fromAge, amount: r.lumpSum }));
  const lumpAccounts = lumpSums
    .filter((r) => !(r.fromAge > ageNowOf(r.owner)))
    .map((r) => ({ id: `lump-${r.id}`, owner: r.owner, type: 'pretax', balance: r.lumpSum }));

  const proj = values.calculators.projection;
  // The pension calculator weighs the first pension row, whichever way the plan takes it; its lump
  // sum is on the row (an older save: the calculator's own, moveLumpSumToRow).
  const firstPensionRow = pensionRows[0];
  const firstPension = firstPensionRow && {
    owner: firstPensionRow.owner,
    monthly: firstPensionRow.amount,
    startAge: firstPensionRow.fromAge,
    cola: firstPensionRow.cola,
    survivorShare: firstPensionRow.survivorShare,
    lumpSum: firstPensionRow.lumpSum > 0 ? firstPensionRow.lumpSum : blankAsZero(values.calculators.pension?.lumpSum),
    election: firstPensionRow.election,
  };
  return {
    version: 2,
    year,
    filingStatus: values.filingStatus,
    people,
    accounts: [
      ...values.accounts.map((acc) => ({
      id: acc.id,
      owner: ids.has(acc.owner) ? acc.owner : 'p1',
      type: acc.type,
      balance: blankAsZero(acc.balance),
      ...(acc.type === 'taxable' && { basisShare: Number(acc.basisShare ?? 0.5) }),
      // its own dividend yield (blank: the assumption; taxCalculator.js taxableAccountDividends)
      ...(acc.type === 'taxable' && String(acc.dividendYield ?? '').trim() !== '' && { dividendYield: Number(acc.dividendYield) }),
      })),
      ...lumpAccounts,
    ],
    incomes,
    pensions,
    rollovers,
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
            election: firstPension.election,
            ...pensionFromValues({
              penLumpSum: String(firstPension.lumpSum),
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
      // Income above the need (projection.js): saved in a taxable account (the default) or spent.
      surplus: a.surplus === 'spend' ? 'spend' : 'save',
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
    if (p.socialSecurity.mode === 'receiving' && (!isNum(p.socialSecurity.received) || p.socialSecurity.received < 0)) {
      errors.push(`Enter ${whose(p.id)} monthly Social Security benefit as received now.`);
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
    if (r.type === 'pension' && (!isNum(r.lumpSum) || r.lumpSum < 0)) errors.push("A pension's lump sum can't be negative.");
    if (r.type === 'pension' && r.election === 'lumpSum' && !(r.lumpSum > 0)) errors.push('Enter the lump sum offered to take it in the plan.');
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

