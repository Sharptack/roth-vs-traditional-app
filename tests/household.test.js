import { describe, it, expect } from 'vitest';
import { calculateEmploymentTaxes, calculateHouseholdEmploymentTaxes } from '../src/lib/ficaTax.js';
import {
  estimateHouseholdSocialSecurity,
  estimateSocialSecurityBenefit,
  spousalAdjustmentFactor,
} from '../src/lib/socialSecurity.js';
import {
  PREVIEW_DEFAULT_VALUES,
  SPOUSE_DEFAULT_VALUES,
  accountRowsFromFlat,
  householdToCompareInputs,
  toHousehold,
  validateHousehold,
} from '../src/lib/household.js';
import { DEFAULT_FORM_VALUES, toCompareInputs } from '../src/lib/formInputs.js';
import { compareRothVsTraditional, splitAtTakeHome, splitAtTakeHomeByPerson } from '../src/lib/compare.js';
import { checkContributionLimit, combineLimitChecks } from '../src/lib/contributionLimits.js';

const Y = 2026; // wage base $184,500; bend points $1,286 / $7,749

describe('calculateHouseholdEmploymentTaxes (2026, HAND CALC)', () => {
  it('two W-2 earners each get their own wage base; Additional Medicare on the combined wages', () => {
    // p1 $200,000: SS 6.2% x 184,500 = 11,439;  Medicare 1.45% x 200,000 = 2,900
    // p2 $100,000: SS 6.2% x 100,000 =  6,200;  Medicare 1.45% x 100,000 = 1,450
    // Additional Medicare 0.9% x (300,000 - 250,000) = 450
    // total = 11,439 + 2,900 + 6,200 + 1,450 + 450 = 22,439
    // (one earner with $300,000 would pay 11,439 + 4,350 + 450 = 16,239: p2's 6,200 SS is the fix)
    const r = calculateHouseholdEmploymentTaxes({
      earners: [{ wages: 200000 }, { wages: 100000 }],
      filingStatus: 'mfj',
      year: Y,
    });
    expect(r.w2.socialSecurity).toBeCloseTo(17639, 6);
    expect(r.w2.medicare).toBeCloseTo(4350, 6);
    expect(r.additionalMedicare).toBeCloseTo(450, 6);
    expect(r.total).toBeCloseTo(22439, 6);
    expect(r.people[1].total).toBeCloseTo(7650, 6);
  });

  it("a 1099 spouse's self-employment tax uses their own wage base, not the W-2 earner's leftover room", () => {
    // p1 W-2 $150,000: SS 9,300;  Medicare 2,175
    // p2 1099 $50,000: net earnings 50,000 x 0.9235 = 46,175
    //   SS 12.4% x 46,175 = 5,725.70;  Medicare 2.9% x 46,175 = 1,339.075
    //   SE tax 7,064.775;  deduction (half) 3,532.3875
    // Additional Medicare: 150,000 + 46,175 = 196,175 < 250,000 -> 0
    // total = 9,300 + 2,175 + 7,064.775 = 18,539.775
    // (single-earner model: SE SS limited to 184,500 - 150,000 = 34,500 -> 4,278 instead of 5,725.70)
    const r = calculateHouseholdEmploymentTaxes({
      earners: [{ wages: 150000 }, { selfEmploymentIncome: 50000 }],
      filingStatus: 'mfj',
      year: Y,
    });
    expect(r.selfEmployment.netEarnings).toBeCloseTo(46175, 6);
    expect(r.selfEmployment.socialSecurity).toBeCloseTo(5725.7, 6);
    expect(r.selfEmployment.tax).toBeCloseTo(7064.775, 6);
    expect(r.selfEmployment.deduction).toBeCloseTo(3532.3875, 6);
    expect(r.additionalMedicare).toBe(0);
    expect(r.total).toBeCloseTo(18539.775, 6);
  });

  it('one earner gives exactly calculateEmploymentTaxes', () => {
    for (const wages of [0, 50000, 184500, 250000, 400000]) {
      for (const selfEmploymentIncome of [0, 300, 40000, 200000]) {
        for (const filingStatus of ['single', 'mfj']) {
          const one = calculateEmploymentTaxes({ wages, selfEmploymentIncome, filingStatus, year: Y });
          const hh = calculateHouseholdEmploymentTaxes({ earners: [{ wages, selfEmploymentIncome }], filingStatus, year: Y });
          expect(hh.total).toBeCloseTo(one.total, 9);
          expect(hh.additionalMedicare).toBeCloseTo(one.additionalMedicare, 9);
          expect(hh.selfEmployment).toEqual(one.selfEmployment);
          expect(hh.w2).toEqual(one.w2);
        }
      }
    }
  });
});

describe('spousalAdjustmentFactor (HAND CALC)', () => {
  it('25/36 of 1% a month for 36 months, then 5/12 of 1%; no credits after FRA', () => {
    expect(spousalAdjustmentFactor(0)).toBe(1);
    expect(spousalAdjustmentFactor(24)).toBe(1); // no delayed credits on a spousal benefit
    expect(spousalAdjustmentFactor(-12)).toBeCloseTo(1 - 12 * 25 / 36 / 100, 12); // 8.333% off
    expect(spousalAdjustmentFactor(-36)).toBeCloseTo(0.75, 12); // 36 x 25/36% = 25%
    expect(spousalAdjustmentFactor(-60)).toBeCloseTo(0.65, 12); // 25% + 24 x 5/12% = 35%
  });
});

describe('claiming age as its own input (2026, HAND CALC)', () => {
  it('one person claiming at 70 instead of at retirement (65)', () => {
    // $100,000, age 35 (born 1991, FRA 67). AIME 8,333.33.
    // PIA = 1,157.40 + 0.32 x 6,463 (2,068.16) + 0.15 x 584.333 (87.65) = 3,313.21
    // 70 is 36 months after FRA: +36 x 2/3% = +24% -> 4,108.3804 / month -> 49,300.565 / year
    const values = { ...PREVIEW_DEFAULT_VALUES, claimAge: '70' };
    const r = compareRothVsTraditional(householdToCompareInputs(toHousehold(values, Y)));
    expect(r.socialSecurity.annualBenefit).toBeCloseTo(49300.565, 2);
    expect(r.years).toBe(30); // still retires at 65
  });

  it('a claiming age outside 62-70 is an error', () => {
    expect(validateHousehold(toHousehold({ ...PREVIEW_DEFAULT_VALUES, claimAge: '60' }, Y))).toContain(
      'Choose your Social Security claiming age (62–70), or leave it blank.',
    );
  });
});

describe('estimateHouseholdSocialSecurity (2026, HAND CALC)', () => {
  // Shared PIAs (2026 bend points 1,286 / 7,749; born 1960+ -> FRA 67):
  //   p1 $120,000: AIME 10,000. PIA = 0.9 x 1,286 (1,157.40) + 0.32 x 6,463 (2,068.16)
  //                + 0.15 x 2,251 (337.65) = 3,563.21 / month
  //   p2 $20,000:  AIME 1,666.6667. PIA = 1,157.40 + 0.32 x 380.6667 (121.8133) = 1,279.2133
  //   half p1's PIA = 1,781.605; p2's excess = 1,781.605 - 1,279.2133 = 502.3917 / month
  //   p2 claims own at 62: 60 months early, 36 x 5/9% + 24 x 5/12% = 30% off -> 895.4493 / month
  const earner = (earnings, currentAge, claimAge) => ({ earnings, currentAge, claimAge, knowsSocialSecurity: false });

  it('same ages; p1 claims at 67, so the spousal part starts at 67, unreduced', () => {
    // p1: 3,563.21 x 12 = 42,758.52
    // p2: own 895.4493 x 12 = 10,745.392;  excess 502.3917 x 12 = 6,028.70 (factor 1)
    //     -> 16,774.092;  household 59,532.612
    const r = estimateHouseholdSocialSecurity({ earners: [earner(120000, 45, 67), earner(20000, 45, 62)], year: Y });
    expect(r.people[0].annualBenefit).toBeCloseTo(42758.52, 4);
    expect(r.people[0].spousalTopUp).toBe(0);
    expect(r.people[1].ownBenefit).toBeCloseTo(10745.392, 3);
    expect(r.people[1].spousalStartAge).toBe(67);
    expect(r.people[1].spousalTopUp).toBeCloseTo(6028.7, 3);
    expect(r.annualBenefit).toBeCloseTo(59532.612, 3);
    expect(r.estimated).toBe(true);
  });

  it('both claim at 62: the spousal excess takes the steeper spousal reduction', () => {
    // p1: 42,758.52 x 0.70 = 29,930.964
    // p2: 10,745.392 + 6,028.70 x 0.65 (3,918.655) = 14,664.047;  household 44,595.011
    const r = estimateHouseholdSocialSecurity({ earners: [earner(120000, 45, 62), earner(20000, 45, 62)], year: Y });
    expect(r.people[0].annualBenefit).toBeCloseTo(29930.964, 3);
    expect(r.people[1].spousalAdjustmentFactor).toBeCloseTo(0.65, 12);
    expect(r.people[1].annualBenefit).toBeCloseTo(14664.047, 3);
    expect(r.annualBenefit).toBeCloseTo(44595.011, 3);
  });

  it("an older spouse's claim date sets when the younger one's spousal part starts", () => {
    // p1 is 48 (born 1978, FRA 67), claims at 67; p2 (45) is 64 then -> 36 months early -> 0.75
    // p2: 10,745.392 + 6,028.70 x 0.75 (4,521.525) = 15,266.917;  household 58,025.437
    const r = estimateHouseholdSocialSecurity({ earners: [earner(120000, 48, 67), earner(20000, 45, 62)], year: Y });
    expect(r.people[1].spousalStartAge).toBe(64);
    expect(r.people[1].annualBenefit).toBeCloseTo(15266.917, 3);
    expect(r.annualBenefit).toBeCloseTo(58025.437, 3);
  });

  it('a known benefit is used as entered and gives the other spouse no spousal top-up', () => {
    const r = estimateHouseholdSocialSecurity({
      earners: [{ knowsSocialSecurity: true, socialSecurityBenefit: 40000 }, earner(0, 45, 67)],
      year: Y,
    });
    expect(r.people[0].annualBenefit).toBe(40000);
    expect(r.people[1].annualBenefit).toBe(0);
    expect(r.annualBenefit).toBe(40000);
  });

  it('one earner gives exactly estimateSocialSecurityBenefit', () => {
    for (const earnings of [0, 30000, 100000, 300000]) {
      for (const [age, claim] of [[35, 65], [50, 62], [60, 70], [40, 75]]) {
        const one = estimateSocialSecurityBenefit({ annualIncome: earnings, currentAge: age, retirementAge: claim, year: Y });
        const hh = estimateHouseholdSocialSecurity({ earners: [earner(earnings, age, claim)], year: Y });
        expect(hh.annualBenefit).toBe(one.annualBenefit);
      }
    }
  });
});

describe('splitAtTakeHomeByPerson (HAND CALC)', () => {
  it('each spouse is capped at their own limit, not one shared limit', () => {
    // t = 22%, currently Roth. p1 saves 30,000 (limit 24,500), p2 saves 10,000 (limit 24,500).
    // p1: Roth 24,500 to the account, 5,500 to taxable.
    //     Pre-tax: 30,000 / 0.78 = 38,461.54 -> capped 24,500, costing 24,500 x 0.78 = 19,110;
    //     the other 30,000 - 19,110 = 10,890 to taxable.
    // p2: Roth 10,000, nothing over.  Pre-tax 10,000 / 0.78 = 12,820.5128, fits.
    // household: Roth 34,500 + 5,500;  Pre-tax 37,320.5128 + 10,890
    // (one shared 24,500 limit would put 15,500 / 20,890 in taxable instead)
    const r = splitAtTakeHomeByPerson(
      [{ amount: 30000, limit: 24500 }, { amount: 10000, limit: 24500 }],
      'roth',
      0.22,
    );
    expect(r.takeHomeCost).toBeCloseTo(40000, 6);
    expect(r.roth.toAccount).toBeCloseTo(34500, 6);
    expect(r.roth.excessToTaxable).toBeCloseTo(5500, 6);
    expect(r.pretax.toAccount).toBeCloseTo(37320.5128, 3);
    expect(r.pretax.excessToTaxable).toBeCloseTo(10890, 6);
    expect(r.people).toHaveLength(2);
  });

  it('one person gives exactly splitAtTakeHome', () => {
    for (const amount of [0, 10000, 24500, 40000]) {
      for (const type of ['roth', 'pretax']) {
        const { people, ...sum } = splitAtTakeHomeByPerson([{ amount, limit: 24500 }], type, 0.24);
        expect(sum).toEqual(splitAtTakeHome(amount, type, 0.24, 24500));
        expect(people).toHaveLength(1);
      }
    }
  });
});

describe('combineLimitChecks', () => {
  it('adds the limits and labels each message', () => {
    const r = combineLimitChecks([
      { label: 'For you', check: checkContributionLimit(30000, '401k', Y, 45) },
      { label: 'For your spouse', check: checkContributionLimit(10000, '401k', Y, 55) },
    ]);
    // 24,500 + (24,500 + 8,000 catch-up at 55) = 57,000
    expect(r.limit).toBe(57000);
    expect(r.catchUp).toBe(8000);
    expect(r.atLimit).toBe(true);
    expect(r.overLimit).toBe(true);
    expect(r.message).toMatch(/^For you: Your savings amount is above the 2026 401\(k\) contribution limit/);
    expect(r.message).not.toContain('For your spouse');
  });
});

describe('toHousehold / householdToCompareInputs', () => {
  const variants = [
    {},
    { filingStatus: 'mfj', grossIncome: '250000' },
    { incomeType: '1099', grossIncome: '80000' },
    { incomeType: 'both', selfEmploymentIncome: '30000', currentAge: '52', savings: '40000', currentType: 'roth' },
    { knowsSocialSecurity: 'yes', socialSecurityBenefit: '28000', otherTaxableBalance: '75000', otherTaxableBasis: '0.25' },
    { otherRothBalance: '50000', retirementLifestyle: '1.3', returnRate: '0.05', accountType: 'ira' },
    { grossIncome: '', currentAge: '' }, // invalid stays invalid, with the same messages
    { filingStatus: 'mfj', includeSpouse: 'no', spouseIncome: '90000' }, // spouse not included: ignored
  ];

  it('a one-person household reproduces the flat inputs exactly, and the same result', () => {
    for (const v of variants) {
      const flatValues = { ...DEFAULT_FORM_VALUES, ...v };
      const flat = toCompareInputs(flatValues, Y);
      const expected = compareRothVsTraditional(flat);
      // without an accounts list (the current form, old share links), and with the same
      // balances as an accounts list (the preview's form)
      for (const values of [
        { ...flatValues, ...SPOUSE_DEFAULT_VALUES },
        { ...flatValues, ...SPOUSE_DEFAULT_VALUES, ...v, accounts: accountRowsFromFlat(flatValues) },
      ]) {
        const household = toHousehold(values, Y);
        expect(household.people).toHaveLength(1);
        expect(householdToCompareInputs(household)).toEqual(flat);
        expect(compareRothVsTraditional(householdToCompareInputs(household))).toEqual(expected);
      }
    }
  });

  it('an accounts list: several accounts of a type add up; a removed spouse\'s account counts as yours', () => {
    const values = {
      ...PREVIEW_DEFAULT_VALUES,
      accounts: [
        { id: 'a1', owner: 'p1', type: 'pretax', balance: '100,000', basisShare: '0.5' },
        { id: 'a2', owner: 'p2', type: 'pretax', balance: '$50000', basisShare: '0.5' },
        { id: 'a3', owner: 'p1', type: 'taxable', balance: '', basisShare: '0.25' },
      ],
    };
    const h = toHousehold(values, Y); // no spouse entered
    expect(h.accounts.map((a) => [a.owner, a.type, a.balance])).toEqual([
      ['p1', 'pretax', 100000],
      ['p1', 'pretax', 50000],
      ['p1', 'taxable', 0],
    ]);
    expect(validateHousehold(h)).toEqual([]);
    const inputs = householdToCompareInputs(h);
    expect(inputs.otherPretaxBalance).toBe(150000);
    expect(inputs.otherTaxableBasis).toBe(0.25);
  });

  it('builds the documented shape', () => {
    const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
    expect(h).toMatchObject({
      version: 1,
      year: Y,
      filingStatus: 'single',
      people: [{ id: 'p1', birthYear: 1991, retirementAge: 65, wages: 100000, selfEmploymentIncome: 0 }],
      futureContributions: { currentType: 'pretax', accountType: '401k', contributions: [{ owner: 'p1', amount: 10000 }] },
      spending: { debtPaymentsEnding: 6000, otherExpensesEnding: 0, retirementLifestyle: 1 },
      assumptions: { returnRate: 0.07 },
    });
    // the default $100,000 Pre-tax balance is the one row (zero balances get no row)
    expect(h.accounts).toEqual([{ id: 'a1', owner: 'p1', type: 'pretax', balance: 100000 }]);
    expect(validateHousehold(h)).toEqual([]);
  });

  it('several taxable accounts: balance-weighted cost basis', () => {
    // (100,000 x 0.5 + 300,000 x 0.1) / 400,000 = 80,000 / 400,000 = 0.2
    const h = toHousehold(PREVIEW_DEFAULT_VALUES, Y);
    h.accounts = [
      { id: 'a', owner: 'p1', type: 'taxable', balance: 100000, basisShare: 0.5 },
      { id: 'b', owner: 'p1', type: 'taxable', balance: 300000, basisShare: 0.1 },
    ];
    const inputs = householdToCompareInputs(h);
    expect(inputs.otherTaxableBalance).toBe(400000);
    expect(inputs.otherTaxableBasis).toBeCloseTo(0.2, 12);
  });

  describe('with a spouse', () => {
    const values = {
      ...PREVIEW_DEFAULT_VALUES,
      filingStatus: 'mfj',
      includeSpouse: 'yes',
      grossIncome: '120000',
      currentAge: '45',
      retirementAge: '67',
      spouseIncome: '20000',
      spouseAge: '45',
      spouseRetirementAge: '62',
    };

    it('snapshot retirement is the first to retire; earners carry each person', () => {
      // p1 retires in 22 years, p2 in 17 -> 17 years; owner p1 is 45 -> retirementAge 62
      const inputs = householdToCompareInputs(toHousehold(values, Y));
      expect(inputs.grossIncome).toBe(140000);
      expect(inputs.currentAge).toBe(45);
      expect(inputs.retirementAge).toBe(62);
      expect(inputs.contributors).toEqual([
        { amount: 10000, age: 45, label: 'For you' },
        { amount: 0, age: 45, label: 'For your spouse' },
      ]);
      expect(inputs.earners).toEqual([
        { wages: 120000, selfEmploymentIncome: 0, currentAge: 45, claimAge: 67, knowsSocialSecurity: false, socialSecurityBenefit: NaN },
        { wages: 20000, selfEmploymentIncome: 0, currentAge: 45, claimAge: 62, knowsSocialSecurity: false, socialSecurityBenefit: NaN },
      ]);
    });

    it('compare.js uses per-person payroll tax and Social Security', () => {
      // Social Security: the "same ages" case above, 59,532.612
      // Payroll: p1 6.2% x 120,000 (7,440) + 1.45% (1,740); p2 1,240 + 290 -> 10,710; no Additional Medicare
      //   (the single-earner model gives the same here, since 140,000 is under one wage base)
      const r = compareRothVsTraditional(householdToCompareInputs(toHousehold(values, Y)));
      expect(r.valid).toBe(true);
      expect(r.years).toBe(17);
      expect(r.socialSecurity.annualBenefit).toBeCloseTo(59532.612, 3);
      expect(r.current.fica.total).toBeCloseTo(10710, 6);
    });

    it('two high earners pay Social Security tax on both wage bases', () => {
      // as the first payroll test: 200,000 + 100,000 MFJ -> 22,439
      const v = { ...values, grossIncome: '200000', spouseIncome: '100000' };
      const r = compareRothVsTraditional(householdToCompareInputs(toHousehold(v, Y)));
      expect(r.current.fica.total).toBeCloseTo(22439, 6);
    });

    it('each spouse saves under their own limit, with their own catch-up', () => {
      // Pre-tax today: p1 30,000 (45, limit 24,500) + p2 30,000 (55, limit 24,500 + 8,000 = 32,500)
      // deducted now: 24,500 + 30,000 = 54,500 (one shared limit would deduct only 24,500)
      // Roth scenario per person: p1 24,500 to the account; p2's 30,000 fits under 32,500
      const v = { ...values, savings: '30000', spouseSavings: '30000', spouseAge: '55', spouseRetirementAge: '67' };
      const r = compareRothVsTraditional(householdToCompareInputs(toHousehold(v, Y)));
      expect(r.valid).toBe(true);
      expect(r.current.pretaxDeduction).toBe(54500);
      expect(r.limitCheck.limit).toBe(57000);
      expect(r.limitCheck.message).toMatch(/^For you: /);
      expect(r.contributionSplit.people[0].roth.toAccount).toBe(24500);
      expect(r.contributionSplit.people[1].pretax.toAccount).toBe(30000);
      expect(r.contributionSplit.people[1].pretax.excessToTaxable).toBe(0);
      // the blend explorer's all-Roth / all-Pre-tax ends use the same per-person split
      const pts = r.blend.points;
      expect(pts[0].pretaxToAccount).toBeCloseTo(r.contributionSplit.pretax.toAccount, 6);
      expect(pts[0].excessToTaxable).toBeCloseTo(r.contributionSplit.pretax.excessToTaxable, 6);
      expect(pts[pts.length - 1].rothToAccount).toBeCloseTo(r.contributionSplit.roth.toAccount, 6);
      expect(pts[pts.length - 1].excessToTaxable).toBeCloseTo(r.contributionSplit.roth.excessToTaxable, 6);
    });

    it("validates the spouse's ages and the household's structure", () => {
      expect(validateHousehold(toHousehold(values, Y))).toEqual([]);
      const bad = toHousehold({ ...values, spouseAge: '70', spouseRetirementAge: '65' }, Y);
      expect(validateHousehold(bad)).toContain("Your spouse's retirement age must be after their current age.");
      const orphan = toHousehold(values, Y);
      orphan.accounts[0].owner = 'p9';
      expect(validateHousehold(orphan)[0]).toMatch(/someone not in the household/);
      const single = toHousehold(values, Y);
      single.filingStatus = 'single';
      expect(validateHousehold(single)).toContain('A spouse can only be added when filing jointly.');
    });
  });
});
