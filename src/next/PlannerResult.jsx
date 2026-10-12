// The year-by-year planner (roadmap phase 6, decided 2026-10-12): the plan one row per year; click a
// year to add a Roth conversion (or a suggested one) or change a contribution, with its cost that
// year, the room left in the bracket and before IRMAA, and what it is worth over the plan. Changes go
// straight into the plan (decision 1). Renders lib/planner.js; no math of its own.
import { useEffect, useMemo, useState } from 'react';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import {
  allChangesValue,
  changeValue,
  changeableRows,
  contributionRowLabel,
  conversionCost,
  describeChange,
  plannerRows,
  plannerYear,
  suggestions,
} from '../lib/planner.js';
import Blocks from './Blocks.jsx';
import { YearTable } from './ProjectionResult.jsx';
import YearDetail from './YearDetail.jsx';

// Work out something slow (whole projections, up to about a second) after the page has painted, so a
// click shows "Working out…" at once instead of freezing. undefined while working.
function useLater(compute, deps, delay = 30) {
  const [done, setDone] = useState({ deps: null, value: undefined });
  useEffect(() => {
    const t = setTimeout(() => setDone({ deps, value: compute() }), delay);
    return () => clearTimeout(t);
    // compute reads only what deps name (the caller lists them)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const same = done.deps !== null && done.deps.length === deps.length && done.deps.every((d, i) => Object.is(d, deps[i]));
  return same ? done.value : undefined;
}

const WORKING = <span className="dim">Working out…</span>;
const signed = (v, digits = 0) => (Math.abs(v) < 0.5 ? '$0' : `${v > 0 ? '+' : '−'}${$(Math.abs(v), digits)}`);
const SOURCE = { p1: 'Your Pre-tax money', p2: 'Your spouse’s Pre-tax money' };

// The three lifetime figures as a difference (a change against the plan without it).
function ValueCells({ value }) {
  if (value === undefined) return <td colSpan={3}>{WORKING}</td>;
  const d = value.difference;
  return (
    <>
      <td>{signed(d.sustainable)}/yr</td>
      <td>{signed(d.lifetimeTax)}</td>
      <td>{signed(d.afterTaxForHeirs)}</td>
    </>
  );
}

const VALUE_HEADS = (
  <>
    <th scope="col" title="The highest steady after-tax spending the plan supports, with it minus without it">Sustainable spending</th>
    <th scope="col" title="Federal income tax plus Medicare IRMAA, every year">Lifetime tax</th>
    <th scope="col" title="What is left at the end, after the heirs’ tax on Pre-tax money">For heirs, after tax</th>
  </>
);

function CostLine({ cost }) {
  if (cost === undefined) return WORKING;
  if (!cost) return null;
  return (
    <>
      Tax that year {$(cost.tax)}
      {cost.irmaaLater > 0.5 && <>, IRMAA two years on {$(cost.irmaaLater)}</>}
      {cost.effectiveRate !== null && <> ({formatPercent(cost.effectiveRate)} of the amount converted)</>}
      {cost.fromTaxable > 0.5 && <>; paid from the taxable account</>}
      {cost.heldBack > 0.5 && <>; {$(cost.heldBack)} held back from the conversion</>}
    </>
  );
}

// The open year's panel.
function YearPanel({ row, household, need, changes, onAdd, onRemove, locked, couple, pensionCount }) {
  const people = household.people.map((p, i) => ({ id: p.id, alive: row.alive[i] !== false }));
  const [owner, setOwner] = useState(() => people.find((p) => p.alive)?.id ?? 'p1');
  const [amount, setAmount] = useState('');
  const typed = Number(String(amount).replace(/[$,\s]/g, ''));
  const typedOk = Number.isFinite(typed) && typed > 0;
  const year = row.year;

  const view = useLater(() => plannerYear(household, need, year, { owner }), [household, need, year, owner]);
  const suggested = useLater(() => suggestions(household, need, year, owner), [household, need, year, owner]);
  const draft = typedOk ? { year, kind: 'convert', owner, amount: typed } : null;
  const draftCost = useLater(() => (draft ? conversionCost(household, need, draft) : null), [household, need, year, owner, typed], 300);
  const draftValue = useLater(() => (draft ? changeValue(household, need, draft) : null), [household, need, year, owner, typed], 300);
  const here = changes.filter((c) => c.year === year);
  const hereValues = useLater(() => here.map((c) => changeValue(household, need, c)), [household, need, year]);

  const rows = changeableRows(household, row);
  const [rowId, setRowId] = useState(rows[0]?.id ?? '');
  const [rowAmount, setRowAmount] = useState('');
  const [scope, setScope] = useState('year');
  const rowTyped = Number(String(rowAmount).replace(/[$,\s]/g, ''));
  const rowOk = rowAmount.trim() !== '' && Number.isFinite(rowTyped) && rowTyped >= 0 && rows.some((r) => r.id === rowId);

  const pct = (r) => formatPercent(r, 0);
  return (
    <div className="year-detail planner-panel">
      <h4>{year}</h4>
      <p className="planner-facts">
        {view === undefined ? (
          WORKING
        ) : view ? (
          <>
            In the {pct(view.bracket.rate)} bracket, {$(view.bracket.room)} left before {view.bracket.nextRate !== null ? pct(view.bracket.nextRate) : 'the top'}.{' '}
            {view.irmaa ? (
              <>
                Medicare IRMAA for {view.irmaa.premiumYear}: {view.irmaa.tier === 0 ? 'no surcharge' : `tier ${view.irmaa.tier}`}
                {view.irmaa.roomToNext !== null && <>, {$(view.irmaa.roomToNext)} of income before the next tier</>}.
              </>
            ) : (
              <span className="dim">No Medicare IRMAA set by this year{household.assumptions.medicareIrmaa ? ' (no one on Medicare two years on)' : ' (not included in Assumptions)'}.</span>
            )}{' '}
            {view.maxConversion > 0.5 ? <>Up to {$(view.maxConversion)} of Pre-tax money can be converted.</> : <span className="dim">No Pre-tax money left to convert.</span>}
          </>
        ) : null}
      </p>

      <h4>Add a Roth conversion</h4>
      {!locked && (
        <div className="planner-form">
          {couple && (
            <label>
              From{' '}
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {people.filter((p) => p.alive).map((p) => (
                  <option key={p.id} value={p.id}>
                    {SOURCE[p.id]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Amount{' '}
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" size={10} />
          </label>
          <button type="button" className="button" disabled={!typedOk} onClick={() => { onAdd(draft); setAmount(''); }}>
            Add to the plan
          </button>
        </div>
      )}
      {draft && (
        <p className="hint">
          <CostLine cost={draftCost} />
          {draftValue && (
            <>
              . Over the plan: sustainable spending {signed(draftValue.difference.sustainable)} a year, lifetime tax {signed(draftValue.difference.lifetimeTax)}, for heirs {signed(draftValue.difference.afterTaxForHeirs)}.
            </>
          )}
        </p>
      )}

      <div className="table-scroll">
        <table className="compare-table planner-table">
          <thead>
            <tr>
              <th scope="col">Suggested</th>
              <th scope="col">Convert</th>
              <th scope="col">Cost that year</th>
              {VALUE_HEADS}
              {!locked && <th scope="col" aria-label="Add" />}
            </tr>
          </thead>
          <tbody>
            {suggested === undefined && (
              <tr>
                <td colSpan={7}>{WORKING}</td>
              </tr>
            )}
            {suggested?.length === 0 && (
              <tr>
                <td colSpan={7} className="dim">No suggestion: no room left to fill, or no Pre-tax money to convert.</td>
              </tr>
            )}
            {suggested?.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                <td>{$(s.amount)}</td>
                <td>
                  {$(s.cost.total)}
                  {s.cost.irmaaLater > 0.5 && <span className="dim"> (IRMAA {$(s.cost.irmaaLater)})</span>}
                </td>
                <ValueCells value={s.value} />
                {!locked && (
                  <td>
                    <button type="button" className="link-button" onClick={() => onAdd(s.change)}>
                      Add
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Each to the edge in this year alone, rounded down to $100. Cost that year: the federal income tax it adds (with all it pulls into tax,
        such as Social Security) plus the IRMAA surcharge it adds two years on. The last three columns: the plan with it minus the plan without it.
      </p>

      {rows.length > 0 && (
        <>
          <h4>Change a contribution</h4>
          {!locked && (
            <div className="planner-form">
              <select value={rowId} onChange={(e) => setRowId(e.target.value)} aria-label="Contribution">
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {couple ? `${r.owner === 'p1' ? 'You' : 'Spouse'}: ` : ''}
                    {contributionRowLabel(r)}, {$(r.amount)} entered
                  </option>
                ))}
              </select>
              <label>
                to{' '}
                <input type="text" inputMode="decimal" value={rowAmount} onChange={(e) => setRowAmount(e.target.value)} placeholder="$0" size={10} />
              </label>
              <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="For">
                <option value="year">in {year} only</option>
                <option value="onward">from {year} on</option>
              </select>
              <button
                type="button"
                className="button"
                disabled={!rowOk}
                onClick={() => {
                  onAdd({ year, kind: 'contribution', row: rowId, amount: rowTyped, scope });
                  setRowAmount('');
                }}
              >
                Add to the plan
              </button>
            </div>
          )}
        </>
      )}

      {here.length > 0 && (
        <>
          <h4>Changes in this year</h4>
          <div className="table-scroll">
            <table className="compare-table planner-table">
              <thead>
                <tr>
                  <th scope="col">Change</th>
                  {VALUE_HEADS}
                  {!locked && <th scope="col" aria-label="Remove" />}
                </tr>
              </thead>
              <tbody>
                {here.map((c, i) => (
                  <tr key={c.id}>
                    <th scope="row">{describeChange(c, household)}</th>
                    <ValueCells value={hereValues?.[i]} />
                    {!locked && (
                      <td>
                        <button type="button" className="link-button" onClick={() => onRemove(c.id)}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <details className="details">
        <summary>What makes up {year}</summary>
        <YearDetail row={row} couple={couple} pensionCount={pensionCount} />
      </details>
    </div>
  );
}

// household: the version 2 household (its plannerChanges carry ids); need: the spending need;
// onAdd(change) / onRemove(id) change the plan; locked: a view-only link.
export default function PlannerResult({ household, need, error, onAdd, onRemove, locked }) {
  const changes = household?.plannerChanges ?? [];
  const rows = useMemo(() => (household && need !== null ? plannerRows(household, need) : null), [household, need]);
  const all = useLater(() => (rows && changes.length > 0 ? allChangesValue(household, need) : null), [household, need]);
  if (!rows) {
    return (
      <section className="card">
        <h2>Year-by-year planner</h2>
        <p>{error ?? 'Fill in the household inputs to plan it.'}</p>
      </section>
    );
  }
  const marks = {};
  for (const c of changes) marks[c.year] = [marks[c.year], describeChange(c, household)].filter(Boolean).join('; ');
  const byYear = [...changes].sort((a, b) => a.year - b.year);

  const changesBlock = (
    <>
      {changes.length === 0 ? (
        <p className="hint">No changes yet. Click a year below to add a Roth conversion there, or change a contribution.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="compare-table planner-table">
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col">Change</th>
                  {!locked && <th scope="col" aria-label="Remove" />}
                </tr>
              </thead>
              <tbody>
                {byYear.map((c) => (
                  <tr key={c.id}>
                    <td>{c.year}</td>
                    <th scope="row">{describeChange(c, household)}</th>
                    {!locked && (
                      <td>
                        <button type="button" className="link-button" onClick={() => onRemove(c.id)}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="calc planner-total">
            <div className="calc-row heading">
              <span>All of them, against the plan with none</span>
              <span />
            </div>
            {all === undefined ? (
              <div className="calc-row">{WORKING}</div>
            ) : (
              all && (
                <>
                  <div className="calc-row"><span>Sustainable spending</span><span>{signed(all.difference.sustainable)} a year ({$(all.with.sustainable)} against {$(all.without.sustainable)})</span></div>
                  <div className="calc-row"><span>Lifetime tax (income tax and IRMAA)</span><span>{signed(all.difference.lifetimeTax)}</span></div>
                  <div className="calc-row"><span>Left for heirs, after tax</span><span>{signed(all.difference.afterTaxForHeirs)}</span></div>
                </>
              )
            )}
          </div>
        </>
      )}
      <p className="hint">
        A conversion&rsquo;s tax is paid from a taxable account once anyone has retired; while everyone works, or when the taxable
        accounts run short, it is held back from the conversion. Every page that runs the plan includes these changes.
      </p>
    </>
  );
  return (
    <Blocks
      blocks={[
        { id: 'changes', title: 'Your changes', summary: changes.length === 0 ? 'None yet' : `${changes.length} in the plan`, className: 'key-card', content: changesBlock },
        {
          id: 'years',
          title: 'Year by year',
          summary: 'Click a year to plan it',
          content: (
            <YearTable
              rows={rows}
              keyColumns={['converted', 'contributed', 'bracket', 'magi']}
              marks={marks}
              hint="Click a year to add a Roth conversion or change a contribution there, with its cost and what it is worth. ● marks a year with a change."
              renderDetail={(r, ctx) => (
                <YearPanel
                  key={r.year}
                  row={r}
                  household={household}
                  need={need}
                  changes={changes}
                  onAdd={onAdd}
                  onRemove={onRemove}
                  locked={locked}
                  couple={ctx.couple}
                  pensionCount={ctx.pensionCount}
                />
              )}
            />
          ),
        },
      ]}
      disclaimer="Estimates only — not tax or financial advice. The plan as the projection runs it (its strategy, returns and end age), in today’s dollars; each change on top of the withdrawal strategy, which still meets the spending need."
    />
  );
}
