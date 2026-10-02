// The pension calculator's results: the return the lump sum would have to earn to match the
// monthly benefit, against the household's own assumed return. Renders
// lib/pensionCalculator.js's pensionResult; no math of its own.
import { formatCurrency as $, formatPercent } from '../lib/format.js';

const pct = (r) => (r === null ? '—' : formatPercent(r, 1));
const age = (a) => (a === null ? 'never' : `${Math.floor(a)}${a % 1 > 0.001 ? ` and ${Math.round((a % 1) * 12)} months` : ''}`);

// nominalReturn: the household's assumed return with inflation added back (the pension's payments
// are in the dollars of the day they're paid).
export default function PensionResult({ pension: p, inputs, nominalReturn, realReturn, inflation }) {
  const worth = p.presentValueAt(nominalReturn);
  const better = p.irr !== null && p.irr > nominalReturn;
  return (
    <div className="results">
      <section className="card key-card" aria-labelledby="pen-irr">
        <h2 id="pen-irr">The pension&rsquo;s rate of return</h2>
        <div className="hero">
          <div className="hero-value">{p.irr === null ? 'None' : `${pct(p.irr)} a year`}</div>
          <div className="hero-sub">
            What {$(inputs.lumpSum)} would have to earn, every year, to pay {$(inputs.monthly)} a month from {inputs.startAge} to{' '}
            {inputs.endAge}
            {p.months.survivor > 0 && <>, then {formatPercent(inputs.survivorShare, 0)} of it to a surviving spouse until {inputs.spouseEndAge}</>}.
          </div>
        </div>
        <p className="rate-lean">
          <strong>
            {p.irr === null
              ? 'The payments never add up to the lump sum.'
              : better
                ? 'The monthly benefit pays more than the lump sum is assumed to earn.'
                : 'The lump sum is assumed to earn more than the monthly benefit pays.'}
          </strong>
        </p>
        <div className="calc">
          <div className="calc-row">
            <span>Assumed return ({formatPercent(realReturn, 0)} after {formatPercent(inflation, 1)} inflation)</span>
            <span>{pct(nominalReturn)}</span>
          </div>
          <div className="calc-row"><span>The payments&rsquo; value today at that return</span><span>{$(worth)}</span></div>
          <div className="calc-row"><span>The lump sum offered</span><span>{$(inputs.lumpSum)}</span></div>
          <div className="calc-row total"><span>Total of all payments</span><span>{$(p.totalPayments)}</span></div>
          <div className="calc-row sub"><span>Payments add up to the lump sum at age</span><span>{age(p.breakEvenAge)}</span></div>
        </div>
      </section>

      {p.byEndAge.length > 0 && (
        <section className="card" aria-labelledby="pen-ages">
          <h2 id="pen-ages">How long you live decides it</h2>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Payments to age</th>
                <th scope="col">Return a year</th>
              </tr>
            </thead>
            <tbody>
              {p.byEndAge.map((x) => (
                <tr key={x.endAge} className={x.endAge === inputs.endAge ? 'chosen-row' : undefined}>
                  <th scope="row">{x.endAge}</th>
                  <td>{pct(x.irr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {p.months.survivor > 0
              ? 'Each row ends your own payments at that age; the survivor share then runs to your spouse’s end age.'
              : 'Each row ends the payments at that age.'}
          </p>
        </section>
      )}

      <p className="disclaimer">
        Estimates only — not tax or financial advice. Tax is left out: both are taxed alike (the lump sum rolled into a
        Pre-tax account, the pension as ordinary income). Not modeled: the plan&rsquo;s own solvency and PBGC limits.
      </p>
    </div>
  );
}
