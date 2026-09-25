import { compareScenarios } from '../lib/scenarioCompare.js';
import { formatDelta, formatValue } from '../lib/format.js';

// One side of an aligned row: the value, and that scenario's own arithmetic under it.
function Cell({ side, format }) {
  if (!side) return <td className="dim">—</td>;
  return (
    <td>
      {formatValue(side.value, format)}
      {side.detail && <span className="th-sub">{side.detail}</span>}
    </td>
  );
}

function ComparedRows({ rows }) {
  return rows.map((r) =>
    r.kind === 'heading' ? (
      <tr key={r.key} className="group-row">
        <th scope="colgroup" colSpan={4}>
          {r.label}
        </th>
      </tr>
    ) : (
      <tr key={r.key} className={r.kind === 'total' ? 'total-row' : ''}>
        <th scope="row">{r.label}</th>
        <Cell side={r.baseline} format={r.format} />
        <Cell side={r.current} format={r.format} />
        <td className="diff">
          {r.format === 'text'
            ? r.baseline?.value !== r.current?.value && 'changed'
            : formatDelta(r.delta, r.format)}
        </td>
      </tr>
    ),
  );
}

function CompareTable({ rows, caption }) {
  return (
    <div className="table-wrap">
      <table className="compare-table scenario-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" className="row-head"></th>
            <th scope="col">Baseline</th>
            <th scope="col">With your change</th>
            <th scope="col" className="diff">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          <ComparedRows rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

// "Compare a change": pin the current inputs as a baseline, then edit the form and
// see the baseline and the edited scenario side by side.
export default function ScenarioCompare({ baseline, current, onStart, onRebase, onStop }) {
  if (!baseline) {
    return (
      <section className="card compare-card compare-start" aria-label="Compare a change">
        <button type="button" className="button" onClick={onStart} disabled={!current.result.valid}>
          Compare a change
        </button>
        <p className="hint">
          Saves these inputs as a baseline. Then change any input above to see the two side by side,
          including how the rates are calculated.
        </p>
      </section>
    );
  }

  const bothValid = baseline.result.valid && current.result.valid;
  const c = bothValid ? compareScenarios(baseline, current) : null;

  return (
    <section className="card compare-card" aria-labelledby="compare-title">
      <div className="compare-head">
        <h2 id="compare-title">Comparing a change</h2>
        <div className="compare-actions">
          <button type="button" className="button secondary" onClick={onRebase} disabled={!current.result.valid}>
            Make this the new baseline
          </button>
          <button type="button" className="button secondary" onClick={onStop}>
            Stop comparing
          </button>
        </div>
      </div>

      {!bothValid && <p className="alert">Fix the inputs above to see the comparison.</p>}

      {c && (
        <>
          <h3 className="subhead">What changed</h3>
          {c.changes.length === 0 ? (
            <p className="hint">Nothing yet. Change any input above.</p>
          ) : (
            <div className="table-wrap">
              <table className="compare-table changes-table">
                <thead>
                  <tr>
                    <th scope="col" className="row-head"></th>
                    <th scope="col">Baseline</th>
                    <th scope="col">With your change</th>
                  </tr>
                </thead>
                <tbody>
                  {c.changes.map((ch) => (
                    <tr key={ch.label}>
                      <th scope="row">{ch.label}</th>
                      <td>{ch.from}</td>
                      <td>{ch.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="subhead">Results</h3>
          <CompareTable rows={c.headline} caption="Headline results, side by side" />

          <details className="details" open>
            <summary>How the rates are calculated, side by side</summary>
            <div className="details-body">
              <CompareTable rows={c.rateSteps} caption="Effective-rate calculation, side by side" />
              <CompareTable rows={c.drivers} caption="What sets the rate, side by side" />
            </div>
          </details>
        </>
      )}
    </section>
  );
}
