import { LTCG_RATE } from '../lib/constants.js';
import { formatCurrency, formatPercent } from '../lib/format.js';

const $ = (n) => formatCurrency(n);
const minus = (n) => `−${formatCurrency(n)}`;

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

function RetirementNumberMath({ result }) {
  const b = result.retirementNeed.breakdown;
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
          <Row label="FICA (Social Security + Medicare)" value={minus(b.fica)} kind="sub" />
          <Row label="Take-home pay" value={$(b.takeHome)} kind="total" />
          <Row label="Debt payments that will end" value={minus(b.debtPayments)} kind="sub" />
          <Row label="Other expenses that will end" value={minus(b.otherExpenses)} kind="sub" />
          <Row label="Savings for retirement" value={minus(b.savings)} kind="sub" />
          <Row
            label="Retirement income number"
            value={$(result.retirementNeed.target)}
            kind="total"
          />
        </div>
        <p className="hint">
          FICA comes out of your paycheck now but stops when you stop working, so it isn&rsquo;t
          part of what you need to replace. Federal tax only; state tax isn&rsquo;t modeled.
        </p>
      </div>
    </details>
  );
}

function EffectiveRateMath({ result }) {
  const { grossUp: g, otherWithdrawals: o, socialSecurity: ss, retirementNeed, rates } = result;
  const std = result.current.standardDeduction;
  const withdrawalNeeded = g.grossWithdrawal > 0;
  const extraTax = g.solutionStack.totalTax - g.baseStack.totalTax;
  const extraTaxableSS = g.solutionStack.taxableSS - g.baseStack.taxableSS;

  return (
    <details className="details">
      <summary>How is the effective rate calculated?</summary>
      <div className="details-body">
        <p>
          In your first year of retirement, we stack your income sources, work out the tax on them,
          then see how much <em>more</em> tax the withdrawal from this account adds. That extra tax
          divided by the withdrawal is the effective rate.
        </p>

        <div className="calc">
          <Row label="Other income in retirement (before this account)" kind="heading" />
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

          <Row label="What this account has to cover" kind="heading" />
          <Row label="Retirement income number" value={$(retirementNeed.target)} kind="sub" />
          <Row
            label="Gap left after other sources (after tax)"
            value={$(g.remainingAfterTaxNeed)}
            kind="sub"
          />
          {withdrawalNeeded ? (
            <>
              <Row
                label="Gross withdrawal needed from this account"
                value={$(g.grossWithdrawal)}
                kind="total"
              />
              <Row label="With that withdrawal added" kind="heading" />
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
                label={`Effective rate (${$(extraTax)} ÷ ${$(g.grossWithdrawal)})`}
                value={formatPercent(rates.effectiveRetirement)}
                kind="total"
              />
            </>
          ) : (
            <Row label="Withdrawal needed from this account" value="$0" kind="total" />
          )}
        </div>

        {withdrawalNeeded && extraTaxableSS > 0 && (
          <p className="note">
            <strong>Why it can be higher than your tax bracket:</strong> this{' '}
            {$(g.grossWithdrawal)} withdrawal also pulls {$(extraTaxableSS)} more of your Social
            Security into taxable income, so {$(g.grossWithdrawal + extraTaxableSS)} of income gets
            taxed, not just {$(g.grossWithdrawal)}. That is the Social Security phase-in: while your
            combined income sits between the IRS thresholds, each extra dollar you withdraw makes up
            to 85 cents of benefits taxable too.
          </p>
        )}
        {!withdrawalNeeded && (
          <p className="note">
            Your other income already covers the retirement income number, so no withdrawal from
            this account is needed. The rate shown is what an extra withdrawal <em>would</em> be
            taxed at on top of that income.
          </p>
        )}
      </div>
    </details>
  );
}

function winnerText(result) {
  const { winner, afterTaxIncomeDifference } = result.comparison;
  const now = formatPercent(result.rates.marginalNow);
  const later = formatPercent(result.rates.effectiveRetirement);
  if (winner === 'even') {
    return `About even. Your marginal rate now (${now}) and your effective rate in retirement (${later}) are nearly the same, so the tax treatment washes out.`;
  }
  const name = winner === 'pretax' ? 'Pre-tax (Traditional)' : 'Roth';
  const why =
    winner === 'pretax'
      ? `your effective rate in retirement (${later}) is lower than your marginal rate now (${now}), so the deduction today is worth more than the tax you'll pay later.`
      : `your effective rate in retirement (${later}) is higher than your marginal rate now (${now}), so paying tax now on the contribution beats paying it later on the withdrawal.`;
  return `${name} comes out ahead by about ${$(afterTaxIncomeDifference)} of after-tax income per year, because ${why}`;
}

function YourNumbers({ result }) {
  const { retirementNeed, rates, contribution, limitCheck, socialSecurity } = result;
  return (
    <section className="card" aria-labelledby="sec1">
      <h2 id="sec1">Your numbers</h2>

      <div className="hero">
        <div className="hero-label">Retirement income number</div>
        <div className="hero-value">{$(retirementNeed.target)}</div>
        <div className="hero-sub">After-tax income you&rsquo;d need each year in retirement</div>
        <RetirementNumberMath result={result} />
      </div>

      <div className="stats">
        <Stat
          label="Marginal rate while working"
          value={formatPercent(rates.marginalNow)}
          sub="Tax on your next dollar today"
        />
        <Stat
          label="Effective rate in retirement"
          value={formatPercent(rates.effectiveRetirement)}
          sub="Blended rate on a Pre-tax withdrawal"
        />
      </div>
      <EffectiveRateMath result={result} />

      <p className="note">
        These are different kinds of rate on purpose. <strong>Marginal</strong> is what the next
        dollar of income is taxed at today, which is exactly what a Pre-tax contribution saves you.{' '}
        <strong>Effective</strong> is the blended rate across a whole retirement withdrawal, which
        is stacked on top of your other retirement income and taxed bracket by bracket, including
        the extra tax that appears as Social Security benefits phase into taxable income.
      </p>

      {retirementNeed.raw <= 0 && (
        <p className="alert">
          Your debt, other expenses and savings already use up your take-home pay, so the
          retirement income number is $0. Check those inputs.
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Current possible Pre-tax contribution (P)</dt>
          <dd>{$(contribution.pretax)} / year</dd>
        </div>
        <div>
          <dt>Current possible Roth contribution (R)</dt>
          <dd>{$(contribution.roth)} / year</dd>
        </div>
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
      </dl>
      <p className="hint">
        P and R cost the same out of your paycheck: a Pre-tax dollar is worth{' '}
        {formatPercent(rates.marginalNow, 0)} less in take-home pay than a Roth dollar.
      </p>

      {limitCheck.atLimit && <p className="alert">{limitCheck.message}</p>}
    </section>
  );
}

function RothVsPretax({ result }) {
  const { lumpSum, annuity, contribution, comparison } = result;
  const win = (side) => (comparison.winner === side ? 'win' : '');
  return (
    <section className="card" aria-labelledby="sec2">
      <h2 id="sec2">Roth vs. Traditional</h2>
      <p className="verdict">{winnerText(result)}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" className="row-head"></th>
              <th scope="col" className={win('roth')}>
                Roth
                <span className="th-sub">{$(contribution.roth)} / yr</span>
              </th>
              <th scope="col" className={win('pretax')}>
                Pre-tax (Traditional)
                <span className="th-sub">{$(contribution.pretax)} / yr</span>
              </th>
            </tr>
          </thead>
          <tbody>
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
        Pre-tax amounts are reduced by the {formatPercent(result.rates.effectiveRetirement)}{' '}
        effective retirement rate. Roth withdrawals are tax-free.
      </p>
    </section>
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
      label: 'Total income before tax',
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
      label: `Taxable income (Pre-tax withdrawals + taxable Social Security − ${$(std)} standard deduction)`,
      get: (p) => $(p.ordinaryTaxableIncome),
    },
    { label: 'Federal income tax', get: (p) => $(p.ordinaryTax) },
    {
      label: `Capital gains tax (${formatPercent(LTCG_RATE, 0)} of taxable-account withdrawals)`,
      get: (p) => $(p.capitalGainsTax),
    },
    { label: 'Total tax', kind: 'total', get: (p) => $(p.totalTaxPaid) },
    {
      label: 'After-tax income (income before tax − total tax)',
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
          &ldquo;other income.&rdquo;
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
      <YourNumbers result={result} />
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
