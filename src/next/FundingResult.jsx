// The Pre-retirement funding page's results (roadmap phase 4 step d), as blocks: the two measures
// side by side (through retirement leads, decided 2026-10-10), the savings needed for each with
// "Use in the plan", and the 4% at retirement in detail. Renders lib/funding.js's fundingView; no
// math of its own.
import { formatCurrency as $ } from '../lib/format.js';
import { PAGES } from '../lib/route.js';
import { FUNDED_STATUS_LABELS, fundingTile } from '../lib/suiteTiles.js';
import Blocks from './Blocks.jsx';

const pct = (x) => `${Math.round(x * 100)}%`;
const share = (x) => `${Math.round(x * 1000) / 10}%`;

// "age 65", or for a couple "you 65, your spouse 63".
function agesLabel(ages) {
  if (ages.length === 1) return `age ${ages[0]}`;
  return ages.map((a, i) => `${i === 0 ? 'you' : 'your spouse'} ${a}`).join(', ');
}

// One measure's savings needed, in words.
function savingsText(s, target) {
  if (!s.reachable) return `Out of reach by saving more: no amount a year reaches ${pct(target)} (too few working years left).`;
  if (s.extra <= -s.planned && s.planned > 0) return `Met even saving nothing (today: ${$(s.planned)} a year).`;
  if (s.extra <= -s.planned) return 'Met without saving anything.';
  const change = Math.abs(s.extra) < 1 ? 'the same as today' : `${$(Math.abs(s.extra))} ${s.extra > 0 ? 'more' : 'less'} than today`;
  return `Save ${$(s.total)} a year, ${change}.`;
}

// error: why there is no view (the spending need's reason). choices: { through, at } from
// lib/funding.js savingsChoice; onUse(choice) writes one into the plan (absent when locked).
export default function FundingResult({ view, error, choices, onUse }) {
  if (!view) {
    return (
      <section className="card">
        <h2>Pre-retirement funding</h2>
        <p>{error ?? 'Fill in the household inputs to work it out.'}</p>
      </section>
    );
  }
  if (view.retired) {
    return (
      <section className="card">
        <h2>Pre-retirement funding</h2>
        <p>
          Everyone in the household is retired already, so there are no working years left to save in. See{' '}
          <a href={PAGES.spending}>Retirement spending</a> for what the resources allow.
        </p>
      </section>
    );
  }
  const { need, target, through, at, savings } = view;
  const tile = fundingTile(view);
  const status = (s) => FUNDED_STATUS_LABELS[s];
  const track = (
    <>
      <div className="hero">
        <div className="hero-value">{pct(through.funded)}</div>
        <div className="hero-sub">
          funded through retirement: {status(through.status).toLowerCase()}. The resources allow {$(through.sustainable)} per year after
          tax, against a spending need of {$(need)}.
        </div>
      </div>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Through retirement</th>
              <th scope="col">At retirement (4%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                What the assets pay
                <span className="th-sub">Per year, after tax</span>
              </th>
              <td>{$(through.sustainable)}</td>
              <td>
                {$(at.income)}
                <span className="th-sub">in {at.year}</span>
              </td>
            </tr>
            <tr>
              <th scope="row">The spending need</th>
              <td>{$(need)}</td>
              <td>{$(at.need)}</td>
            </tr>
            <tr className="total-row">
              <th scope="row">Funded</th>
              <td>{pct(through.funded)}</td>
              <td>{pct(at.funded)}</td>
            </tr>
            <tr>
              <th scope="row">Status</th>
              <td>{status(through.status)}</td>
              <td>{status(at.status)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="note">
        <strong>Through retirement</strong> is the highest steady after-tax spending the plan supports to its end without falling short,
        leaving any legacy goal, with every other part of the plan as it stands. <strong>At retirement</strong> is the rule of thumb: in
        the year the last person retires ({agesLabel(at.ages)}), 4% of every account plus Social Security, pensions and other income, less
        all tax and IRMAA. Within 5% of the need is about even.
      </p>
    </>
  );
  const row = (key, label) => {
    const s = savings[key];
    const choice = choices?.[key];
    return (
      <div key={key} className="savings-measure">
        <h3>{label}</h3>
        <p>{savingsText(s, target)}</p>
        {s.reachable && s.pay > 0 && s.total > 0 && (
          <p className="hint">
            {share(s.totalShareOfPay)} of household pay ({$(s.pay)} this year)
            {Math.abs(s.extra) >= 1 ? `; the change is ${share(Math.abs(s.extraShareOfPay))} of pay` : ''}.
          </p>
        )}
        {choice && onUse && (
          <div className="use-in-plan">
            <button type="button" className="button" onClick={() => onUse(choice)}>
              Use in the plan: save {$(choice.total)} a year
            </button>
          </div>
        )}
      </div>
    );
  };
  const savingsBlock = (
    <>
      <p>
        The savings a year that bring each measure to <strong>{pct(target)} funded</strong> (set under Funding target), with the spending
        need held at {$(need)}.
      </p>
      {row('through', 'Through retirement')}
      {row('at', 'At retirement (4%)')}
      <p className="hint">
        The change is spread across the contribution rows in proportion to today&rsquo;s amounts (with none, to a taxable account, split
        by pay), each person saving until their own retirement. Amounts over the IRS limit go to a taxable account. The employer match
        stays on the contributions as entered.
      </p>
    </>
  );
  const b = at.balances;
  const detail = (
    <dl className="facts">
      <div>
        <dt>The year the last person retires</dt>
        <dd>
          {at.year} ({agesLabel(at.ages)})
        </dd>
      </div>
      <div>
        <dt>Accounts at the start of that year</dt>
        <dd>
          {$(b.total)} (Pre-tax {$(b.pretax)}, Roth {$(b.roth)}, taxable {$(b.taxable)})
        </dd>
      </div>
      <div>
        <dt>4% withdrawal</dt>
        <dd>{$(at.withdrawals.total)}</dd>
      </div>
      <div>
        <dt>Social Security, pensions and other income</dt>
        <dd>{$(at.otherIncome)}</dd>
      </div>
      <div>
        <dt>Tax and IRMAA that year</dt>
        <dd>{$(at.totalTax + (at.irmaa ?? 0))}</dd>
      </div>
      <div>
        <dt>After-tax income</dt>
        <dd>{$(at.income)}</dd>
      </div>
    </dl>
  );
  const lead = savings.through;
  return (
    <Blocks
      blocks={[
        { id: 'track', title: 'Is the household on track?', summary: tile.headline, className: 'key-card', content: track },
        {
          id: 'savings',
          title: 'Savings needed',
          summary: lead.reachable ? savingsText(lead, target) : 'Out of reach by saving more',
          content: savingsBlock,
        },
        { id: 'atRetirement', title: 'At retirement, in detail', summary: `${$(at.income)} in ${at.year}`, content: detail },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Today’s dollars at constant after-inflation returns; the same plan as the year-by-year projection; no state tax."
    />
  );
}
