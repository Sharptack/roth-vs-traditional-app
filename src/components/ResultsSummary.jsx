import { formatCurrency, formatPercent } from '../lib/format.js';

const $ = (n) => formatCurrency(n);
const minus = (n) => `−${formatCurrency(n)}`;
const signedPercent = (factor) => {
  const pct = Math.round((factor - 1) * 100);
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
};

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// One line of a step-by-step calculation.
// kind: 'total' (bold, rule above), 'sub' (indented), 'heading' (section label)
function Row({ label, value, kind = '' }) {
  return (
    <div className={`calc-row ${kind}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1 — Retirement income number (its own section)              */
/* ------------------------------------------------------------------ */

function RetirementNumberMath({ result }) {
  const b = result.retirementNeed.breakdown;
  const { lifestyleFactor, beforeLifestyleAdjustment, target } = result.retirementNeed;
  const adjusted = lifestyleFactor !== 1;
  const hasSE = b.selfEmploymentIncome > 0;
  return (
    <details className="details">
      <summary>How is this calculated?</summary>
      <div className="details-body">
        <p>
          Your take-home pay today, minus the costs that will be gone by retirement, minus what
          you&rsquo;re saving. What&rsquo;s left is the lifestyle you already live on.
        </p>
        <div className="calc">
          <Row label="Gross income" value={$(b.grossIncome)} />
          <Row label="Federal income tax" value={minus(b.incomeTax)} kind="sub" />
          <Row
            label={hasSE ? 'FICA and self-employment tax' : 'FICA (Social Security + Medicare)'}
            value={minus(b.fica)}
            kind="sub"
          />
          <Row label="Take-home pay" value={$(b.takeHome)} kind="total" />
          <Row label="Debt payments that will end" value={minus(b.debtPayments)} kind="sub" />
          <Row label="Other expenses that will end" value={minus(b.otherExpenses)} kind="sub" />
          <Row label="Savings for retirement" value={minus(b.savings)} kind="sub" />
          <Row
            label={adjusted ? 'Spending today' : 'Retirement income number'}
            value={$(beforeLifestyleAdjustment)}
            kind="total"
          />
          {adjusted && (
            <>
              <Row
                label={`Adjustment for your expected retirement lifestyle (${signedPercent(lifestyleFactor)})`}
                value={`${target >= beforeLifestyleAdjustment ? '+' : '−'}${$(Math.abs(target - beforeLifestyleAdjustment))}`}
                kind="sub"
              />
              <Row label="Retirement income number" value={$(target)} kind="total" />
            </>
          )}
        </div>
        <p className="hint">
          FICA comes out of your paycheck now but stops when you stop working, so it isn&rsquo;t
          part of what you need to replace. Federal tax only; state tax isn&rsquo;t modeled.
          {hasSE && (
            <>
              {' '}
              Half of your self-employment tax ({$(b.selfEmploymentDeduction)}) is deducted from
              your income before income tax.
            </>
          )}
        </p>
      </div>
    </details>
  );
}

function RetirementNumberSection({ result }) {
  const { retirementNeed, socialSecurity } = result;
  const adjusted = retirementNeed.lifestyleFactor !== 1;
  const direction = retirementNeed.lifestyleFactor > 1 ? 'higher' : 'lower';
  const portfolioNeed = Math.max(0, retirementNeed.target - socialSecurity.annualBenefit);
  return (
    <section className="card" aria-labelledby="sec1">
      <h2 id="sec1">Retirement income number</h2>

      <div className="hero">
        <div className="hero-value">{$(retirementNeed.target)}</div>
        <div className="hero-sub">After-tax income per year</div>
      </div>

      <dl className="facts lead-facts">
        <div>
          <dt>Social Security benefit used</dt>
          <dd>
            {$(socialSecurity.annualBenefit)} / year
            {socialSecurity.estimated && (
              <span className="dim">
                {' '}
                — Estimated — see{' '}
                <a href="https://www.ssa.gov" target="_blank" rel="noreferrer">
                  ssa.gov
                </a>{' '}
                for a precise figure
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Income needed from your portfolio</dt>
          <dd>{$(portfolioNeed)} / year</dd>
        </div>
      </dl>

      <p className="note">
        <strong>What this number is:</strong> the after-tax amount you need each year in retirement
        to keep the same lifestyle you have while working. It&rsquo;s the amount you actually
        spend.
        {adjusted && (
          <>
            {' '}
            You chose a retirement lifestyle {direction} than today&rsquo;s, so it&rsquo;s scaled by{' '}
            {signedPercent(retirementNeed.lifestyleFactor)}.
          </>
        )}
      </p>

      {retirementNeed.raw <= 0 && (
        <p className="alert">
          Your debt, other expenses and savings already use up your take-home pay, so the
          retirement income number is $0. Check those inputs.
        </p>
      )}

      <RetirementNumberMath result={result} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2 — Roth vs. Traditional                                     */
/* ------------------------------------------------------------------ */

function yearsWithoutSSVerdict(result) {
  const s = result.withoutSocialSecurity;
  const { winner, afterTaxIncomeDifference } = s.comparison;
  const now = formatPercent(result.rates.marginalNow);
  const later = formatPercent(s.effectiveRateRetirement);
  if (winner === 'even') {
    return `About even: your marginal rate today (${now}) and the effective rate on these withdrawals without Social Security (${later}) are nearly the same, so the tax treatment washes out.`;
  }
  const name = winner === 'pretax' ? 'Pre-tax (Traditional)' : 'Roth';
  const why =
    winner === 'pretax'
      ? `the effective rate on these withdrawals without Social Security (${later}) is below your marginal rate today (${now})`
      : `the effective rate on these withdrawals without Social Security (${later}) is above your marginal rate today (${now})`;
  return `${name} comes out ahead by about ${$(afterTaxIncomeDifference)} of after-tax income per year, because ${why}.`;
}

function YearsWithoutSocialSecurity({ result }) {
  const s = result.withoutSocialSecurity;
  const { annuity, retirementNeed, otherWithdrawals: o, rates } = result;
  const std = result.current.standardDeduction;
  const win = (side) => (s.comparison.winner === side ? 'win' : '');
  const withdrawalNeeded = s.grossUp.grossWithdrawal > 0;
  const extraTax = s.grossUp.solutionStack.totalTax - s.grossUp.baseStack.totalTax;
  const higherLifestyle = retirementNeed.lifestyleFactor > 1;

  return (
    <details className="details">
      <summary>Retirement years without Social Security</summary>
      <div className="details-body">
        <p>
          You may have years in retirement before Social Security starts, for example if you retire
          before you claim benefits, or you may want to plan without it. Here Social Security is set
          to $0, so your whole {$(retirementNeed.target)} retirement income number has to come from
          your accounts. With no Social Security to phase in, the tax is plain brackets, and the
          rate on these withdrawals is the blended rate: the extra tax they cause, divided by the
          withdrawals.
        </p>

        <div className="calc">
          <Row label="Retirement income without Social Security" kind="heading" />
          <Row label="Retirement income number" value={$(retirementNeed.target)} kind="sub" />
          <Row
            label="Other Pre-tax accounts (4% withdrawal)"
            value={$(o.pretaxGross)}
            kind="sub"
          />
          {o.roth > 0 && <Row label="Other Roth accounts (4%, tax-free)" value={$(o.roth)} kind="sub" />}
          {o.taxableGross > 0 && (
            <Row label="Other taxable accounts (4% withdrawal)" value={$(o.taxableGross)} kind="sub" />
          )}
          <Row
            label="Pre-tax withdrawal needed from this account"
            value={$(s.grossUp.grossWithdrawal)}
            kind="sub"
          />
          {withdrawalNeeded ? (
            <>
              <Row
                label={`Taxable income after the ${$(std)} standard deduction`}
                value={$(s.taxableIncomeAtTop)}
                kind="sub"
              />
              <Row
                label="Extra tax caused by this account's withdrawal"
                value={$(extraTax)}
                kind="total"
              />
              <Row
                label={`Effective rate on these withdrawals (${$(extraTax)} ÷ ${$(s.grossUp.grossWithdrawal)})`}
                value={formatPercent(s.effectiveRateRetirement)}
                kind="total"
              />
            </>
          ) : (
            <>
              <Row
                label="This account's own natural withdrawal (4% of its projected value)"
                value={$(s.grossUp.probeSize)}
                kind="sub"
              />
              <Row
                label="Extra tax that withdrawal would cause"
                value={$(s.grossUp.probeExtraTax)}
                kind="sub"
              />
              <Row
                label={`Effective rate on these withdrawals (${$(s.grossUp.probeExtraTax)} ÷ ${$(s.grossUp.probeSize)})`}
                value={formatPercent(s.effectiveRateRetirement)}
                kind="total"
              />
            </>
          )}
          <Row
            label="Bracket the last dollar falls in (for reference)"
            value={formatPercent(s.marginalRateRetirement, 0)}
            kind="sub"
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" className="row-head"></th>
                <th scope="col" className={win('roth')}>Roth</th>
                <th scope="col" className={win('pretax')}>Pre-tax (Traditional)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Total value of account</th>
                <td>{$(annuity.roth.futureValue)}</td>
                <td>{$(annuity.pretax.futureValue)}</td>
              </tr>
              <tr>
                <th scope="row">
                  Annual withdrawal
                  <span className="th-sub">4% of the account</span>
                </th>
                <td>{$(annuity.roth.annualWithdrawal)}</td>
                <td>{$(annuity.pretax.annualWithdrawal)}</td>
              </tr>
              <tr>
                <th scope="row">Effective rate on the withdrawal</th>
                <td>0%</td>
                <td>{formatPercent(s.effectiveRateRetirement)}</td>
              </tr>
              <tr>
                <th scope="row">After-tax income</th>
                <td className={win('roth')}>{$(s.annuity.roth.afterTaxWithdrawal)}</td>
                <td className={win('pretax')}>{$(s.annuity.pretax.afterTaxWithdrawal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="verdict simple-verdict">{yearsWithoutSSVerdict(result)}</p>

        <p className="hint">
          Your marginal rate today is {formatPercent(rates.marginalNow, 0)}. The blended rate on
          these withdrawals is lower than the bracket of their last dollar because the lower
          brackets are taxed first.
        </p>
        <p className="note">
          {withdrawalNeeded && !higherLifestyle && (
            <>
              <strong>Reading this:</strong> without Social Security, your retirement income is
              lower than your income today, so your retirement bracket can&rsquo;t be higher than
              your bracket now. This view can only tie or favor Pre-tax. Compare it with the main
              result above: the difference between the two is the effect of Social Security.
            </>
          )}
          {withdrawalNeeded && higherLifestyle && (
            <>
              <strong>Reading this:</strong> you expect to spend more in retirement than you do
              today, so your retirement bracket can end up higher than your bracket now. That is how
              a higher-earning future can favor Roth. Compare it with the main result above: the
              difference between the two is the effect of Social Security.
            </>
          )}
          {!withdrawalNeeded && (
            <>
              <strong>Reading this:</strong> your other accounts alone already produce more taxable
              income than you need, so your bracket in retirement is set by those balances, not by
              this account.
            </>
          )}
        </p>
      </div>
    </details>
  );
}

function RothVsPretax({ result }) {
  const { lumpSum, annuity, contribution, contributionSplit, comparison, limitCheck } = result;
  const win = (side) => (comparison.winner === side ? 'win' : '');
  return (
    <section className="card" aria-labelledby="sec2">
      <h2 id="sec2">Roth vs. Traditional</h2>

      <TaxRates result={result} />

      {limitCheck.atLimit && <p className="alert">{limitCheck.message}</p>}

      <h3 className="subhead">Comparison table</h3>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              <th scope="col" className={win('roth')}>
                Roth
              </th>
              <th scope="col" className={win('pretax')}>
                Pre-tax (Traditional)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                Current possible contribution
                <span className="th-sub">Per year, at the same take-home cost</span>
              </th>
              <td>
                {$(contribution.roth)}
                {contributionSplit.roth.excessToTaxable > 0 && (
                  <span className="th-sub">
                    {$(contributionSplit.roth.toAccount)} to the account, rest to taxable
                  </span>
                )}
              </td>
              <td>
                {$(contribution.pretax)}
                {contributionSplit.pretax.excessToTaxable > 0 && (
                  <span className="th-sub">
                    {$(contributionSplit.pretax.toAccount)} to the account, rest to taxable
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">
                Value of a single contribution at retirement
                <span className="th-sub">One year&rsquo;s contribution, grown</span>
              </th>
              <td>{$(lumpSum.roth.futureValue)}</td>
              <td>{$(lumpSum.pretax.futureValueGross)}</td>
            </tr>
            <tr>
              <th scope="row">After-tax value of that contribution</th>
              <td className={win('roth')}>{$(lumpSum.roth.afterTaxValue)}</td>
              <td className={win('pretax')}>{$(lumpSum.pretax.afterTaxValue)}</td>
            </tr>
            <tr>
              <th scope="row">
                Total value of account
                <span className="th-sub">Contributing every year until retirement</span>
              </th>
              <td>{$(annuity.roth.futureValue)}</td>
              <td>{$(annuity.pretax.futureValue)}</td>
            </tr>
            <tr>
              <th scope="row">
                After-tax income
                <span className="th-sub">Per year, from a 4% withdrawal</span>
              </th>
              <td className={win('roth')}>{$(annuity.roth.afterTaxWithdrawal)}</td>
              <td className={win('pretax')}>{$(annuity.pretax.afterTaxWithdrawal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">
        The two contributions cost you the same take-home pay. A Pre-tax dollar comes out of income
        that would have been taxed at your {formatPercent(result.rates.marginalNow, 0)} marginal
        rate, so {$(contribution.pretax)} Pre-tax costs about what {$(contribution.roth)} Roth
        does. Pre-tax amounts at retirement are reduced by the{' '}
        {formatPercent(result.rates.effectiveRetirement)} effective rate on these withdrawals. Roth
        withdrawals are tax-free.
      </p>

      <YearsWithoutSocialSecurity result={result} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tax rates (top of section 2) and total portfolio comparison (3)      */
/* ------------------------------------------------------------------ */

function EffectiveRateMath({ result }) {
  const { grossUp: g, otherWithdrawals: o, socialSecurity: ss, retirementNeed, rates, annuity } = result;
  const std = result.current.standardDeduction;
  const withdrawalNeeded = g.grossWithdrawal > 0;
  const extraTax = g.solutionStack.totalTax - g.baseStack.totalTax;
  const extraTaxableSS = g.solutionStack.taxableSS - g.baseStack.taxableSS;
  const overall = result.retirementOverall;

  return (
    <details className="details">
      <summary>How are the retirement rates calculated?</summary>
      <div className="details-body">
          <p className="note">
            <strong>How the rates fit together.</strong> Your <strong>marginal rate</strong> is the tax
            on your next dollar of income today, which is exactly what a Pre-tax contribution saves you.
            The <strong>effective rate on these withdrawals</strong> is the tax caused by the
            withdrawals from this account, as a share of those withdrawals, including the extra tax
            that appears when Social Security benefits become taxable. That is the rate that matters
            for the Roth vs. Pre-tax choice: Pre-tax comes out ahead when it is lower than your
            marginal rate today, and Roth when it is higher. Your{' '}
            <strong>overall effective rate</strong> is simply all the tax you owe in retirement divided
            by all the gross income you receive, Social Security and every account included.
          </p>

        <p>
          <strong>&ldquo;This account&rdquo;</strong> is the account your contributions are building.
          Everything else &mdash; Social Security plus withdrawals from the other retirement balances
          you entered &mdash; is <strong>other income</strong>.
        </p>
        <ol className="steps">
          <li>
            Work out how much your <em>other income</em> already delivers after tax in your first
            year of retirement.
          </li>
          <li>
            Whatever is still missing from your retirement income number has to come from this
            account. We calculate the pre-tax withdrawal that delivers exactly that amount after
            tax.
          </li>
          <li>
            Add that withdrawal on top of the other income and re-do the tax. The <em>extra</em>{' '}
            tax it causes, divided by the withdrawal, is the effective rate on these withdrawals.
            Total tax divided by total gross income is the overall effective rate.
          </li>
        </ol>

        <div className="calc">
          <Row label="Step 1: income from everything except this account" kind="heading" />
          <Row label="Social Security benefit" value={$(ss.annualBenefit)} kind="sub" />
          <Row label="Other Pre-tax accounts (4% withdrawal)" value={$(o.pretaxGross)} kind="sub" />
          {o.roth > 0 && <Row label="Other Roth accounts (4%, tax-free)" value={$(o.roth)} kind="sub" />}
          {o.taxableGross > 0 && (
            <Row label="Other taxable accounts (4% withdrawal)" value={$(o.taxableGross)} kind="sub" />
          )}
          <Row
            label="Taxable part of Social Security (IRS combined-income rules)"
            value={$(g.baseStack.taxableSS)}
            kind="sub"
          />
          <Row
            label={`Taxable income after the ${$(std)} standard deduction`}
            value={$(g.baseStack.ordinaryTaxableIncome)}
            kind="sub"
          />
          <Row label="Tax on that income" value={$(g.baseStack.totalTax)} kind="sub" />
          <Row
            label="After-tax income from other sources"
            value={$(g.afterTaxFromOtherSources)}
            kind="total"
          />

          <Row label="Step 2: what this account has to supply" kind="heading" />
          <Row label="Retirement income number" value={$(retirementNeed.target)} kind="sub" />
          <Row
            label={`Still needed from this account, after tax (${$(retirementNeed.target)} − ${$(g.afterTaxFromOtherSources)})`}
            value={$(g.remainingAfterTaxNeed)}
            kind="sub"
          />
          {withdrawalNeeded ? (
            <>
              <Row
                label="Pre-tax withdrawal that delivers that amount after tax"
                value={$(g.grossWithdrawal)}
                kind="total"
              />
              <Row label="Step 3: add that withdrawal and re-do the tax" kind="heading" />
              <Row
                label="Taxable part of Social Security"
                value={$(g.solutionStack.taxableSS)}
                kind="sub"
              />
              <Row
                label="Taxable income after the standard deduction"
                value={$(g.solutionStack.ordinaryTaxableIncome)}
                kind="sub"
              />
              <Row label="Total tax" value={$(g.solutionStack.totalTax)} kind="sub" />
              <Row
                label={`Extra tax caused by the withdrawal (${$(g.solutionStack.totalTax)} − ${$(g.baseStack.totalTax)})`}
                value={$(extraTax)}
                kind="total"
              />
              <Row
                label={`Effective rate on these withdrawals (${$(extraTax)} ÷ ${$(g.grossWithdrawal)})`}
                value={formatPercent(rates.effectiveRetirement)}
                kind="total"
              />
            </>
          ) : (
            <>
              <Row label="Withdrawal needed from this account" value="$0" kind="total" />
              <Row
                label="Step 3: what a withdrawal from it would cost, if you took one"
                kind="heading"
              />
              <Row
                label="This account's own natural withdrawal (4% of its projected value)"
                value={$(g.probeSize)}
                kind="sub"
              />
              <Row label="Extra tax that withdrawal would cause" value={$(g.probeExtraTax)} kind="sub" />
              <Row
                label={`Effective rate on these withdrawals (${$(g.probeExtraTax)} ÷ ${$(g.probeSize)})`}
                value={formatPercent(rates.effectiveRetirement)}
                kind="total"
              />
            </>
          )}
          <Row
            label={`Overall effective rate (${$(overall.totalTax)} total tax ÷ ${$(overall.grossIncome)} gross income)`}
            value={formatPercent(rates.overallEffectiveRetirement)}
            kind="total"
          />
        </div>

        {withdrawalNeeded && extraTaxableSS > 0 && (
          <p className="note">
            <strong>Why the rate on these withdrawals can be higher than your tax bracket:</strong>{' '}
            this {$(g.grossWithdrawal)} withdrawal also pulls {$(extraTaxableSS)} more of your
            Social Security into taxable income, so {$(g.grossWithdrawal + extraTaxableSS)} of income
            gets taxed, not just {$(g.grossWithdrawal)}. That is the Social Security phase-in: while
            your combined income sits between the IRS thresholds, each extra dollar you withdraw
            makes up to 85 cents of benefits taxable too.
          </p>
        )}
        {!withdrawalNeeded && (
          <p className="note">
            Your other income already covers the retirement income number, so no withdrawal from
            this account is needed. The rate shown is what this account&rsquo;s own natural
            withdrawal &mdash; {$(annuity.pretax.annualWithdrawal)}, 4% of its projected value
            &mdash; <em>would</em> be taxed at on top of that income, since that is the size a
            withdrawal from it would actually be.
          </p>
        )}
      </div>
    </details>
  );
}

function TaxRates({ result }) {
  const { rates } = result;
  return (
    <div className="tax-rates">
      <h3 className="subhead">Your tax rates</h3>

      <div className="rate-pair">
        <div className="rate-pair-item">
          <div className="stat-label">Marginal rate while working</div>
          <div className="stat-value">{formatPercent(rates.marginalNow)}</div>
          <div className="stat-sub">Tax on your next dollar today</div>
        </div>
        <div className="rate-pair-vs">vs</div>
        <div className="rate-pair-item highlight">
          <div className="stat-label">Effective rate on these withdrawals</div>
          <div className="stat-value">{formatPercent(rates.effectiveRetirement)}</div>
          <div className="stat-sub">The rate that decides Roth vs. Pre-tax</div>
        </div>
      </div>

      <EffectiveRateMath result={result} />
    </div>
  );
}

function BucketBreakdown({ buckets }) {
  return (
    <ul className="breakdown">
      <li>Pre-tax {$(buckets.pretax)}</li>
      <li>Roth {$(buckets.roth)}</li>
      <li>Taxable {$(buckets.taxable)}</li>
    </ul>
  );
}

const SCENARIOS = [
  { key: 'roth', title: 'All-Roth scenario' },
  { key: 'pretax', title: 'All-Pre-tax scenario' },
];

// Walks each scenario from account withdrawals + Social Security to after-tax
// income, so the Social Security effect is visible in the arithmetic.
function PortfolioMath({ result }) {
  const { portfolio, socialSecurity: ss, current } = result;
  const std = current.standardDeduction;
  const rows = [
    { label: 'Pre-tax account withdrawals', get: (p) => $(p.withdrawals.pretax) },
    { label: 'Roth account withdrawals (tax-free)', get: (p) => $(p.withdrawals.roth) },
    { label: 'Taxable account withdrawals', get: (p) => $(p.withdrawals.taxable) },
    { label: 'Social Security benefit', get: () => $(ss.annualBenefit) },
    {
      label: 'Gross income (withdrawals + Social Security)',
      kind: 'total',
      get: (p) => $(p.totalGrossWithdrawal + ss.annualBenefit),
    },
    {
      label: 'Taxable part of Social Security',
      get: (p) => $(p.taxableSS),
      sub: (p) =>
        ss.annualBenefit > 0 ? `${formatPercent(p.taxableSS / ss.annualBenefit, 0)} of benefit` : '',
    },
    {
      label: 'Adjusted gross income, AGI (Pre-tax + taxable-account withdrawals + taxable Social Security)',
      get: (p) => $(p.withdrawals.pretax + p.withdrawals.taxable + p.taxableSS),
    },
    {
      label: `Ordinary taxable income (Pre-tax withdrawals + taxable Social Security − ${$(std)} standard deduction)`,
      get: (p) => $(p.ordinaryTaxableIncome),
    },
    { label: 'Federal income tax', get: (p) => $(p.ordinaryTax) },
    {
      label: 'Capital gains tax (real 0% / 15% / 20% brackets, on top of ordinary income)',
      get: (p) => $(p.capitalGainsTax),
      sub: (p) =>
        p.withdrawals.taxable > 0
          ? `${formatPercent(p.capitalGainsTax / p.withdrawals.taxable)} of the taxable withdrawal`
          : '',
    },
    { label: 'Total tax', kind: 'total', get: (p) => $(p.totalTaxPaid) },
    {
      label: 'After-tax income (gross income − total tax)',
      kind: 'total',
      get: (p) => $(p.achievedAfterTaxIncome),
    },
  ];
  return (
    <details className="details">
      <summary>Show the calculation</summary>
      <div className="details-body">
        <p>
          Each scenario draws the same share of every account (scaled until the after-tax income
          matches your target). Social Security is added on top and is taxed under the IRS
          combined-income rules, using your Pre-tax and taxable-account withdrawals as the
          &ldquo;other income.&rdquo; Taxable-account withdrawals are treated as capital gain and
          taxed at the real 0% / 15% / 20% capital-gains rates, stacked on top of your ordinary
          income &mdash; not a flat rate, so a withdrawal can be partly or fully tax-free when your
          other income is modest.
        </p>
        <div className="table-wrap">
          <table className="calc-table">
            <thead>
              <tr>
                <th scope="col" className="row-head"></th>
                {SCENARIOS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={r.kind === 'total' ? 'total-row' : ''}>
                  <th scope="row">{r.label}</th>
                  {SCENARIOS.map((c) => (
                    <td key={c.key}>
                      {r.get(portfolio[c.key])}
                      {r.sub && r.sub(portfolio[c.key]) && (
                        <span className="th-sub">{r.sub(portfolio[c.key])}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function PortfolioComparison({ result }) {
  const { portfolio, taxDifference, retirementNeed, socialSecurity } = result;
  const short = SCENARIOS.filter((c) => !portfolio[c.key].targetMet);
  const lowerTaxName = taxDifference.lowerTaxScenario === 'roth' ? 'All-Roth' : 'All-Pre-tax';
  const higherTaxName = taxDifference.lowerTaxScenario === 'roth' ? 'All-Pre-tax' : 'All-Roth';

  return (
    <section className="card" aria-labelledby="sec3">
      <h2 id="sec3">Total portfolio tax comparison</h2>
      <p className="hint">
        Same after-tax lifestyle in both columns, funded from your whole portfolio (this account
        plus your other balances, grown to retirement) together with Social Security.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              {SCENARIOS.map((c) => (
                <th key={c.key} scope="col">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total future portfolio value</th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>
                  {$(portfolio[c.key].totalValue)}
                  <BucketBreakdown buckets={portfolio[c.key].buckets} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Social Security benefit
                <span className="th-sub">Per year; received in full, only part is taxed</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>
                  {$(socialSecurity.annualBenefit)}
                  <span className="th-sub">{$(portfolio[c.key].taxableSS)} taxable</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Total gross withdrawal needed
                <span className="th-sub">Per year, from portfolio accounts</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].totalGrossWithdrawal)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Total tax paid
                <span className="th-sub">Per year, federal</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].totalTaxPaid)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                After-tax income achieved
                <span className="th-sub">
                  Withdrawals + Social Security − tax. Should equal {$(retirementNeed.target)}
                </span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{$(portfolio[c.key].achievedAfterTaxIncome)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                Withdrawal rate needed
                <span className="th-sub">Share of the portfolio drawn per year</span>
              </th>
              {SCENARIOS.map((c) => (
                <td key={c.key}>{formatPercent(portfolio[c.key].impliedWithdrawalRate)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <PortfolioMath result={result} />

      <div className="callout">
        <div className="callout-label">Total tax difference between scenarios</div>
        <div className="callout-value">{$(taxDifference.amount)} per year</div>
        <p>
          {taxDifference.lowerTaxScenario === 'even'
            ? 'Both approaches cost about the same in tax to deliver the same lifestyle.'
            : `That is the tax cost of getting the identical after-tax lifestyle: the ${lowerTaxName} scenario pays ${$(taxDifference.amount)} less in tax each year than the ${higherTaxName} scenario.`}
        </p>
      </div>

      <p className="hint">
        Tax paid is not the whole story. The Pre-tax scenario also got a deduction along the way,
        so it starts with a larger balance. Compare the withdrawal rates: a lower rate means the
        same lifestyle takes less of your portfolio each year, even if the tax bill is higher.
      </p>

      {short.length > 0 && (
        <p className="alert">
          With these balances, the {short.map((c) => c.title).join(' and ')} can&rsquo;t reach your
          target. Add savings or lower your retirement income number.
        </p>
      )}
    </section>
  );
}

export default function ResultsSummary({ result }) {
  if (!result.valid) {
    return (
      <section className="card" aria-labelledby="sec0">
        <h2 id="sec0">Results</h2>
        <p>Fill in the form above to see your comparison.</p>
        <ul className="errors">
          {result.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="results">
      <RetirementNumberSection result={result} />
      <RothVsPretax result={result} />
      <PortfolioComparison result={result} />
      <p className="disclaimer">
        Estimates only — not tax or financial advice. Based on {result.dataYear} federal tax rules,
        with no state tax, no inflation, and a simplified proportional withdrawal from every
        account. Results are in today&rsquo;s dollars.
      </p>
    </div>
  );
}
