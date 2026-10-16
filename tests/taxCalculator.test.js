import { describe, it, expect } from 'vitest';
import { householdToYearTaxParams, taxCalculatorResult } from '../src/lib/taxCalculator.js';
import { PREVIEW_DEFAULT_VALUES, toHousehold } from '../src/lib/household.js';
import { toHouseholdV2 } from '../src/lib/householdV2.js';
import { DEFAULT_HOUSEHOLD_VALUES } from '../src/lib/householdValues.js';

const Y = 2026;
const run = (values) => taxCalculatorResult(householdToYearTaxParams(toHousehold({ ...PREVIEW_DEFAULT_VALUES, ...values }, Y)));

describe('tax calculator (2026, HAND CALC)', () => {
  it('the default household this year: wages lead, Pre-tax savings are deducted', () => {
    // $100,000 wages, $10,000 Pre-tax savings -> taxable 100,000 - 10,000 - 16,100 = 73,900
    // tax 1,240 + 4,560 + 22% x 23,500 (5,170) = 10,970; payroll 7,650
    // the bar: 10% full (12,400), 12% full (38,000), 22% with 23,500 of 55,300, then 24% empty;
    // room left in 22%: 105,700 - 73,900 = 31,800
    const t = run({});
    expect(t.result.lines.pretaxDeferrals).toBe(10000);
    expect(t.result.incomeTax).toBeCloseTo(10970, 6);
    expect(t.marginal.source).toBe('wages');
    expect(t.marginal.incomeTax).toBeCloseTo(0.22, 9);
    expect(t.marginal.total).toBeCloseTo(0.2965, 9);
    expect(t.bar.segments.map((s) => [s.rate, s.from, s.to, s.filled])).toEqual([
      [0.1, 0, 12400, 12400],
      [0.12, 12400, 50400, 38000],
      [0.22, 50400, 105700, 23500],
      [0.24, 105700, 201775, 0],
    ]);
    expect(t.bar.room).toBe(31800);
  });

  it('a retiree at 70 with a pension and Social Security: Pre-tax withdrawals lead, 65+ deductions apply', () => {
    // pension/withdrawals 20,000, Social Security 30,000 -> taxable SS 5,350 (as the engine's case)
    // AGI 25,350; deduction 16,100 + 2,050 + 6,000 = 24,150 -> taxable 1,200 -> tax 120
    // next $100 withdrawn: +$85 of SS taxable too -> +$185 at 10% -> 18.5%
    const t = run({ grossIncome: '0', currentAge: '70', retirementAge: '71', savings: '0', taxOrdinaryIncome: '20000', taxSocialSecurity: '30000' });
    expect(t.result.lines.standardDeduction).toBe(24150);
    expect(t.result.incomeTax).toBeCloseTo(120, 6);
    expect(t.marginal.source).toBe('ordinaryIncome');
    expect(t.marginal.incomeTax).toBeCloseTo(0.185, 9);
    expect(t.others.map((o) => o.source)).toEqual([
      'wages', 'selfEmploymentIncome', 'investmentOrdinaryIncome', 'preferentialIncome', 'socialSecurity',
    ]);
  });

  it('each spouse deducts Pre-tax savings up to their own limit', () => {
    // you 30,000 (limit 24,500), spouse 30,000 at 55 (limit 32,500) -> 24,500 + 30,000 = 54,500
    const t = run({ filingStatus: 'mfj', includeSpouse: 'yes', savings: '30000', spouseSavings: '30000', spouseAge: '55', spouseRetirementAge: '67', spouseIncome: '90000' });
    expect(t.result.lines.pretaxDeferrals).toBe(54500);
    expect(t.result.payroll.people).toHaveLength(2);
  });

  it('Roth savings are not deducted', () => {
    expect(run({ currentType: 'roth' }).result.lines.pretaxDeferrals).toBe(0);
  });
});

describe('the effective marginal rate, step by step (2026, HAND CALC)', () => {
  const steps = (values) => run(values).steps;
  const byKey = (s) => Object.fromEntries(s.rows.map((r) => [r.key, r.value]));

  it('the next $100 withdrawn makes $85 of Social Security taxable: $185 at 12%', () => {
    // age 70, withdrawals 30,000, SS 30,000: provisional income 30,000 + 15,000 = 45,000
    // taxable SS = min(15,000, 4,500) + 85% x (45,000 - 34,000) = 4,500 + 9,350 = 13,850 (under 25,500)
    // ordinary gross 43,850; deductions 16,100 + 2,050 + 6,000 = 24,150 -> taxable 19,700 (12%)
    // +100 -> +85 taxable SS -> +185 taxable -> +22.20 tax -> 22.2%
    const s = steps({ grossIncome: '0', currentAge: '70', retirementAge: '71', savings: '0', taxOrdinaryIncome: '30000', taxSocialSecurity: '30000' });
    expect(s.rows.map((r) => r.key)).toEqual(['probe', 'socialSecurity', 'taxable', 'ordinaryTax', 'extraTax']);
    const v = byKey(s);
    expect(v.socialSecurity).toBeCloseTo(85, 9);
    expect(v.taxable).toBeCloseTo(185, 9);
    expect(v.ordinaryTax).toBeCloseTo(22.2, 9);
    expect(s.rows.find((r) => r.key === 'ordinaryTax').label).toBe('Tax on $185 at 12%');
    expect(s.rate).toBeCloseTo(0.222, 9);
    expect(s.payroll).toBe(0);
  });

  it('the senior deduction phasing out: $6 of deduction lost per $100, $106 at 22%', () => {
    // age 70, withdrawals 90,000: senior deduction 6,000 - 6% x (90,000 - 75,000) = 5,100
    // deductions 16,100 + 2,050 + 5,100 = 23,250 -> taxable 66,750 (22%)
    // +100 -> deduction -6 -> taxable +106 -> +23.32 -> 23.32%
    const s = steps({ grossIncome: '0', currentAge: '70', retirementAge: '71', savings: '0', taxOrdinaryIncome: '90000' });
    const v = byKey(s);
    expect(v.deduction).toBeCloseTo(6, 9);
    expect(v.taxable).toBeCloseTo(106, 9);
    expect(s.extraTax).toBeCloseTo(23.32, 9);
    expect(s.rate).toBeCloseTo(0.2332, 9);
  });

  it('wages: 22% income tax, 29.65% with payroll tax; matches the headline rate', () => {
    // the default household: taxable 73,900 (22%); +100 wages -> +22 tax, +7.65 payroll
    const t = run({});
    expect(t.steps.rate).toBeCloseTo(0.22, 9);
    expect(t.steps.payroll).toBeCloseTo(7.65, 9);
    expect(t.steps.rateWithPayroll).toBeCloseTo(0.2965, 9);
    expect(t.steps.rate).toBeCloseTo(t.marginal.incomeTax, 12);
  });
});

describe("the bracket visual's scale: total income and taxable income (2026-10-09, HAND CALC)", () => {
  // Joint, 49, $125,000 of 1099 income, $12,000 Pre-tax 401(k) (Michael's example):
  //  SE tax 125,000 x 0.9235 x 15.3% = 17,661.94; half 8,830.97
  //  AGI 125,000 - 8,830.97 - 12,000 = 104,169.03; less 32,200 = 71,969.03
  //  QBI: 20% x 116,169.03 = 23,233.81, held to 20% x 71,969.03 = 14,393.81
  //  taxable 57,575.22; tax 2,480 + 12% x 32,775.22 = 6,413.03; room to 22%: 100,800 - 57,575.22
  const params = {
    filingStatus: 'mfj',
    year: 2026,
    people: [{ age: 49, wages: 0, selfEmploymentIncome: 125000 }],
    pretaxDeferrals: 12000,
    qbi: true,
    income: {},
  };
  it('the bridge from total income to taxable income', async () => {
    const { taxableIncomeBridge } = await import('../src/lib/taxCalculator.js');
    const t = taxCalculatorResult(params);
    expect(t.result.incomeTax).toBeCloseTo(6413.03, 1);
    const rows = taxableIncomeBridge(t.result.lines);
    expect(rows.map((r) => r.key)).toEqual(['total', 'pretax', 'seTax', 'deduction', 'qbi', 'taxable']);
    const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(v.seTax).toBeCloseTo(-8830.97, 1);
    expect(v.qbi).toBeCloseTo(-14393.81, 1);
    expect(v.taxable).toBeCloseTo(57575.22, 1);
    expect(rows.slice(0, -1).reduce((a, r) => a + r.value, 0)).toBeCloseTo(v.taxable, 6);
  });
  it('each edge carries its taxable-income threshold; the room in both measures', async () => {
    const { rateProfile } = await import('../src/lib/rateProfile.js');
    const p = rateProfile(params);
    const to22 = p.edges.find((e) => e.to === 0.22);
    expect(to22.taxable).toBe(100800); // the 22% bracket starts at $100,800 of taxable income, joint
    expect(p.edges.find((e) => e.to === 0.1).taxable).toBe(0);
    expect(p.now.room).toBeCloseTo(43224.78, 1);
    expect(p.now.roomIncome).toBe(to22.income - 125000); // more total income than taxable: the 20% QBI and half SE tax come off too
    expect(p.now.roomIncome).toBeGreaterThan(p.now.room);
  });
});

// Social Security without a retirement age (found 2026-10-16): the tax page asks only for the age,
// so a person already receiving (or claiming at a set age) must count without one.
describe('tax calculator: Social Security with no retirement age (2026, HAND CALC)', () => {
  // Michael's household: MFJ (no spouse entered), age 71 (born 1955-09-04), retirement age blank;
  // $43,000 ordinary other income, $1,000 qualified dividends, $3,000/mo Social Security received.
  const values = (ss) => ({
    ...DEFAULT_HOUSEHOLD_VALUES,
    filingStatus: 'mfj',
    people: [{ ...DEFAULT_HOUSEHOLD_VALUES.people[0], ageEntry: 'age', age: '71', retirementAge: '', planToAge: '' }],
    incomes: [
      { ...DEFAULT_HOUSEHOLD_VALUES.incomes[0], id: 'i1', type: 'other', treatment: 'ordinary', amount: '43000' },
      { ...DEFAULT_HOUSEHOLD_VALUES.incomes[0], id: 'i2', type: 'other', treatment: 'qualified', amount: '1000' },
      { ...DEFAULT_HOUSEHOLD_VALUES.incomes[0], id: 'i3', type: 'socialSecurity', ...ss },
    ],
    contributions: [],
  });
  const runV2 = (v) => taxCalculatorResult(householdToYearTaxParams(toHouseholdV2(v, Y)));

  it('receiving $3,000 a month: the $36,000 counts', () => {
    // provisional income 44,000 + 18,000 = 62,000; MFJ thresholds 32,000 / 44,000:
    //   taxable SS = min(0.85 x 36,000 = 30,600, 0.85 x 18,000 + min(6,000, 18,000) = 21,300) = 21,300
    // deductions 32,200 + 1,650 (65+) + 6,000 (senior, MAGI under 150,000) = 39,850
    // taxable 43,000 + 21,300 + 1,000 - 39,850 = 25,450: ordinary 24,450 x 10% = 2,445; the 1,000 at 0%
    // (without the benefit, as before the fix: 44,000 - 39,850 = 4,150, ordinary 3,150 x 10% = 315)
    const t = runV2(values({ ssMode: 'receiving', amount: '3000' }));
    expect(t.result.lines.socialSecurity).toBe(36000);
    expect(t.result.lines.taxableSocialSecurity).toBeCloseTo(21300, 6);
    expect(t.result.incomeTax).toBeCloseTo(2445, 6);
  });

  it('a PIA claimed at a set age counts too; claimed "at retirement" with no retirement age, nothing yet', () => {
    // born 1955: full retirement age 66 and 2 months; claimed at 67 = 10 months of delayed credits at
    // 2/3% = 6.667%: 2,000 x 1.06667 = 2,133.33 a month = 25,600 a year (claimed: 71 >= 67)
    expect(runV2(values({ ssMode: 'pia', amount: '2000', fromAge: '67' })).result.lines.socialSecurity).toBeCloseTo(25600, 6);
    expect(runV2(values({ ssMode: 'pia', amount: '2000', fromAge: '' })).result.lines.socialSecurity).toBe(0);
  });
});
