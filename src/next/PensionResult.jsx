// The pension calculator's results: the return the lump sum would have to earn to match the
// monthly benefit for life (each payment counted by the chance of being alive for it, SSA's
// period life table), against the household's own assumed return; and the same at fixed ages. Renders
// lib/pensionCalculator.js's pensionResult; no math of its own.
import { pensionHeadlines } from '../lib/blockHeadlines.js';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import Blocks from './Blocks.jsx';

const pct = (r) => (r === null ? '—' : formatPercent(r, 1));
const age = (a) => (a === null ? 'never' : `${Math.floor(a)}${a % 1 > 0.001 ? ` and ${Math.round((a % 1) * 12)} months` : ''}`);

// nominalReturn: the household's assumed return with inflation added back (the pension's payments
// are in the dollars of the day they're paid).
export default function PensionResult({ pension: p, inputs, nominalReturn, realReturn, inflation }) {
  const e = p.expected;
  const worth = e.presentValueAt(nominalReturn);
  const better = e.irr !== null && e.irr > nominalReturn;
  const table = (sex) => (sex === 'male' ? 'men' : sex === 'female' ? 'women' : 'men and women averaged');
  const endAt = (age, years) => Math.round(age + years);
  const h = pensionHeadlines(p, inputs, nominalReturn);
  const rate = (
      <>
        <div className="hero">
          <div className="hero-value">{e.irr === null ? 'None' : `${pct(e.irr)} a year`}</div>
          <div className="hero-sub">
            What {$(inputs.lumpSum)} would have to earn, every year, to pay {$(inputs.monthly)} a month from {inputs.startAge} for
            life
            {e.spouseLifeExpectancy !== null && <>, then {formatPercent(inputs.survivorShare, 0)} of it to a surviving spouse for theirs</>}:
            each payment counted by the chance of being alive to receive it.
          </div>
        </div>
        <p className="rate-lean">
          <strong>
            {e.irr === null
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
          <div className="calc-row"><span>The payments&rsquo; expected value today at that return</span><span>{$(worth)}</span></div>
          <div className="calc-row"><span>The lump sum offered</span><span>{$(inputs.lumpSum)}</span></div>
          <div className="calc-row">
            <span>Life expectancy at {inputs.startAge} ({table(inputs.sex)})</span>
            <span>{e.lifeExpectancy.toFixed(1)} years, to about {endAt(inputs.startAge, e.lifeExpectancy)}</span>
          </div>
          {e.spouseLifeExpectancy !== null && (
            <div className="calc-row">
              <span>Your spouse&rsquo;s, from {inputs.spouseAgeAtStart} ({table(inputs.spouseSex)})</span>
              <span>{e.spouseLifeExpectancy.toFixed(1)} years, to about {endAt(inputs.spouseAgeAtStart, e.spouseLifeExpectancy)}</span>
            </div>
          )}
          <div className="calc-row total"><span>Expected payments in all</span><span>{$(e.expectedPayments)}</span></div>
          <div className="calc-row sub"><span>Payments add up to the lump sum at age</span><span>{age(p.breakEvenAge)}</span></div>
        </div>
      </>
  );
  const ages = (
        <>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">If payments stop at age</th>
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
            {e.spouseLifeExpectancy !== null
              ? 'Each row ends your own payments at that age; the survivor share then runs to your spouse’s life expectancy.'
              : 'Each row ends the payments at that age.'}
          </p>
        </>
  );
  return (
    <Blocks
      blocks={[
        { id: 'irr', title: 'The pension’s rate of return', summary: h.irr, className: 'key-card', content: rate },
        p.byEndAge.length > 0 && { id: 'ages', title: 'How long you live decides it', summary: h.ages, content: ages },
      ]}
      disclaimer="Estimates only — not tax or financial advice. Tax is left out: both are taxed alike (the lump sum rolled into a Pre-tax account, the pension as ordinary income). Life expectancy from SSA’s Period Life Table, 2023 (2026 Trustees Report). Not modeled: the plan’s own solvency and PBGC limits."
    />
  );
}
