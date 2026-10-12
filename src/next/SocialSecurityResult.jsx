// The Social Security calculator's results (phase 5): the household's lifetime benefits under the
// plan's claiming ages and the best pair; the grid of every pair (one row for one person) with each
// cell's benefits; the strategies compared year by year and on a break-even graph (before phase 6,
// asked 2026-10-12); each person's table by claiming age with break-even ages. Renders
// lib/socialSecurityCalculator.js's view; no math of its own. effect: claimingPlanEffect's rows (the
// plan rerun at each age; null while not worked out). onUse(personId, age): "Use in the plan"
// (absent: view only).
import { useState } from 'react';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { socialSecurityHeadlines } from '../lib/blockHeadlines.js';
import { strategyCompare } from '../lib/socialSecurityCalculator.js';
import { strategyRows } from '../lib/socialSecurityLifetime.js';
import Blocks from './Blocks.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { SERIES_COLORS } from '../components/charts/palette.js';

export const WHO = { p1: 'You', p2: 'Your spouse' };
const whose = { p1: 'Your', p2: 'Your spouse’s' };
const k = (x) => `$${Math.round(x / 1000).toLocaleString('en-US')}k`;
const signed = (x) => `${x >= 0 ? '+' : '−'}${$(Math.abs(x))}`;
const sameAges = (x, y) => x.length === y.length && x.every((a, i) => a === y[i]);
const keyOf = (ages) => ages.map((a) => a ?? 'now').join('-');
// Cells chosen in the grid, beside the most (the line colors run out past five strategies).
const MAX_CLICKED = 4;
const ageText = (a) => {
  if (a === null) return 'never (by 119)';
  const months = Math.round((a % 1) * 12);
  const years = Math.floor(a) + (months === 12 ? 1 : 0);
  return months % 12 ? `${years} and ${months} months` : `${years}`;
};

// survival: survivalView's chance of being alive at each age (null: no chart).
export default function SocialSecurityResult({ view, effect, survival, onUse }) {
  const [picked, setPicked] = useState(null); // a grid cell's claiming ages
  const [clicked, setClicked] = useState(['plan']); // cells compared: claiming ages, or 'plan' (the plan's, whatever they become)
  const [shown, setShown] = useState(null); // the strategy in Year by year (its key; null: the first)
  const [futureDollars, setFutureDollars] = useState(false);
  if (!view) {
    return (
      <section className="card">
        <h2>Needs inputs</h2>
        <p>Fill in each person&rsquo;s age and Social Security on the inputs page to work it out.</p>
      </section>
    );
  }
  const { people, plan, tables, grid, pairs, discountRate, inflationRate } = view;
  const couple = people.length === 2;
  const discounted = discountRate > 0;
  const totalWord = discounted ? `discounted at ${formatPercent(discountRate, 0)}` : 'before tax';
  const h = socialSecurityHeadlines(view);
  const planAges = people.map((p) => p.planClaimAge);
  const ageLabel = (p, a) => (a === null ? 'receiving now' : `${a}`);
  const best = couple ? grid.best : tables[0].best ? { claimAges: [tables[0].best.claimAge], discountedTotal: tables[0].best.householdTotal } : null;
  const bestIsPlan = best && best.claimAges.every((a, i) => a === planAges[i]);
  const applyAges = (ages) => ages.forEach((a, i) => a !== null && a !== planAges[i] && onUse(people[i].id, a));
  const resolve = (x) => (x === 'plan' ? planAges : x);
  const strategyLabel = (ages) =>
    couple ? `You ${ages[0] ?? 'now'}, your spouse ${ages[1] ?? 'now'}` : ages[0] === null ? 'Receiving now' : `Claim at ${ages[0]}`;
  const compared = strategyCompare(
    view,
    [pairs.best.claimAges, ...clicked.map(resolve)].filter((x, i, all) => all.findIndex((y) => sameAges(x, y)) === i),
  );
  const strategies = compared.strategies;

  const summary = (
    <>
      <div className="hero">
        <div className="hero-value">{$(plan.discountedTotal)}</div>
        <div className="hero-sub">
          {couple ? (
            <>
              Household Social Security over both lifetimes ({totalWord}), claiming as the plan does:{' '}
              {people.map((p, i) => `${WHO[p.id].toLowerCase()} ${ageLabel(p, planAges[i])}`).join(', ')}. Each person to their life expectancy (
              {people.map((p) => `${WHO[p.id].toLowerCase()} ${p.planToAge}`).join(', ')}).
            </>
          ) : (
            <>
              Social Security over your lifetime ({totalWord}), claiming {planAges[0] === null ? 'as you do now' : `at ${planAges[0]}, as the plan does`}, to your life
              expectancy ({people[0].planToAge}).
            </>
          )}
        </div>
      </div>
      {best && (
        <p className="rate-lean">
          <strong>
            {bestIsPlan
              ? 'The plan’s claiming ages pay the most.'
              : `Most: ${people.map((p, i) => `${WHO[p.id].toLowerCase()} ${ageLabel(p, best.claimAges[i])}`).join(', ')}, ${$(best.discountedTotal)} (${$(best.discountedTotal - plan.discountedTotal)} more).`}
          </strong>
        </p>
      )}
      {best && !bestIsPlan && onUse && (
        <button type="button" className="button" onClick={() => applyAges(best.claimAges)}>
          Use these claiming ages in the plan
        </button>
      )}
      <div className="calc">
        {couple && people.map((p, i) => (
          <div key={p.id}>
            <div className="calc-row"><span>{whose[p.id]} own</span><span>{$(plan.people[i].own)}</span></div>
            {plan.people[i].spousal > 0 && <div className="calc-row sub"><span>{whose[p.id]} spousal benefit (on top)</span><span>{$(plan.people[i].spousal)}</span></div>}
            {plan.people[i].survivor > 0 && <div className="calc-row sub"><span>{whose[p.id]} survivor benefit (on top, after the first death)</span><span>{$(plan.people[i].survivor)}</span></div>}
          </div>
        ))}
        <div className="calc-row total"><span>Before tax, not discounted</span><span>{$(plan.total)}</span></div>
      </div>
      <p className="hint">Today&rsquo;s dollars: benefits rise with prices. Tax on the benefits is in the other calculators.</p>
    </>
  );

  const personBlock = (t, i) => {
    const p = people[i];
    const fx = effect?.[i]?.rows ?? null;
    const fxOf = (age) => fx?.find((r) => r.claimAge === age);
    const bestFx = fx && fx.length > 0 ? fx.reduce((b, r) => (r.sustainable > b.sustainable ? r : b)) : null;
    if (t.receiving) {
      return {
        id: `person-${p.id}`,
        title: `${WHO[p.id]}: already receiving`,
        summary: `${$(t.monthly)} per month`,
        content: <p>{WHO[p.id]} already receive{p.id === 'p1' ? '' : 's'} {$(t.monthly)} a month, so the claiming age is settled; it counts from this year to age {p.planToAge}.</p>,
      };
    }
    return {
      id: `person-${p.id}`,
      title: couple ? `${WHO[p.id]}: when to claim` : 'When to claim',
      summary: h.people[i],
      content: (
        <>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Claim at</th>
                <th scope="col">Per month</th>
                <th scope="col">{couple ? `${whose[p.id]} own, to ${p.planToAge}` : `Lifetime, to ${p.planToAge}`}</th>
                {couple && <th scope="col">Household ({totalWord})</th>}
                {fx && <th scope="col">Spending the plan supports</th>}
                {fx && <th scope="col">Lifetime tax</th>}
                {onUse && <th scope="col"><span className="sr-only">Use</span></th>}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.claimAge} className={r.inPlan ? 'chosen-row' : undefined}>
                  <th scope="row">{r.claimAge}{r.inPlan ? ' (the plan)' : ''}{r === t.best ? ' ★' : ''}</th>
                  <td>{$(r.monthly)}</td>
                  <td>{$(r.ownTotal)}</td>
                  {couple && <td>{$(r.householdTotal)}</td>}
                  {fx && <td className="nowrap">{fxOf(r.claimAge) ? <>{$(fxOf(r.claimAge).sustainable)}{fxOf(r.claimAge) === bestFx ? ' ▲' : ''}</> : '—'}</td>}
                  {fx && <td>{fxOf(r.claimAge) ? $(fxOf(r.claimAge).lifetimeTax) : '—'}</td>}
                  {onUse && (
                    <td>
                      {!r.inPlan && (
                        <button type="button" className="link-button nowrap" onClick={() => onUse(p.id, r.claimAge)}>
                          Use in the plan
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {t.pia > 0 ? <>From a benefit at full retirement age of {$(t.pia)} a month{p.mode === 'estimate' ? ' (estimated from earnings; enter it from ssa.gov for a precise figure)' : ''}. </> : <>No benefit of their own (a full-retirement-age benefit of $0). </>}
            ★ the most for the household{couple ? `, with ${WHO[people[1 - i].id].toLowerCase()} claiming as the plan does` : ''}.
            {couple && ' The household column includes spousal and survivor benefits.'}
          </p>
          {fx ? (
            <p className="hint">
              The plan rerun at each age{couple ? `, ${WHO[people[1 - i].id].toLowerCase()} as the plan has it` : ''}: the steady spending after tax it supports
              through life expectancy (with the legacy goal, if any; ▲ the most), and the lifetime federal income tax and IRMAA at the
              spending need. Taxes, withdrawals and the portfolio included, unlike the benefit totals.
            </p>
          ) : (
            <p className="hint">The plan&rsquo;s spending at each age appears once the spending need is worked out.</p>
          )}
          {t.breakEvens.length > 0 && (
            <div className="calc">
              {t.breakEvens.map((b) => (
                <div key={`${b.earlyAge}-${b.lateAge}`} className="calc-row">
                  <span>Claiming at {b.lateAge} instead of {b.earlyAge} has paid more by age</span>
                  <span>{ageText(b.age)}</span>
                </div>
              ))}
            </div>
          )}
          {t.breakEvens.length > 0 && <p className="hint">Break-even ages on {whose[p.id].toLowerCase()} own benefit, {discounted ? `each year discounted at ${formatPercent(discountRate, 0)}` : 'not discounted'}.</p>}
        </>
      ),
    };
  };

  // The grid (before phase 6, asked 2026-10-12): your claiming age down the side, your spouse's
  // across (one row for one person), each header with that person's monthly benefit; cells shaded
  // by the household total. Choosing a cell shows its benefits and adds it to the strategies compared.
  const rowAges = couple ? pairs.ages[0] : [undefined];
  const colAges = couple ? pairs.ages[1] : pairs.ages[0];
  const agesAt = (a, b) => (couple ? [a, b] : [b]);
  const cellOf = (ages) => pairs.cells.find((c) => sameAges(c.claimAges, ages));
  const monthlyAt = (i, age) => (age === null ? tables[i].monthly : tables[i].rows.find((r) => r.claimAge === age)?.monthly ?? 0);
  const totals = pairs.cells.map((c) => c.discountedTotal);
  const [lo, hi] = [Math.min(...totals), Math.max(...totals)];
  const shade = (c) => ({ background: `color-mix(in srgb, var(--series-1) ${Math.round(4 + 46 * (hi > lo ? (c.discountedTotal - lo) / (hi - lo) : 1))}%, transparent)` });
  const head = (i, age) => (
    <>
      <span>{age ?? 'receiving'}</span>
      <span className="ss-mo">{$(monthlyAt(i, age))}/mo</span>
    </>
  );
  const choose = (ages) => {
    setPicked(ages);
    setShown(keyOf(ages));
    if (!strategies.some((s) => sameAges(s.claimAges, ages))) setClicked((list) => [...list, ages].slice(-MAX_CLICKED));
  };
  const remove = (ages) => setClicked((list) => list.filter((x) => !sameAges(resolve(x), ages)));
  const pickedCell = picked && cellOf(picked);
  const gridBlock = pairs.cells.length > 1 && {
    id: 'grid',
    title: couple ? 'Every pair of claiming ages' : 'Every claiming age',
    summary: `Most: ${strategyLabel(pairs.best.claimAges)}, ${$(pairs.best.discountedTotal)}`,
    content: (
      <>
        <div className="table-scroll">
          <table className="compare-table ss-grid">
            <caption className="sr-only">Household lifetime benefits by claiming age{couple ? ': yours down, your spouse’s across' : ''}</caption>
            <thead>
              <tr>
                <th scope="col" className="ss-corner">{couple ? <>You &darr; &nbsp; Your spouse &rarr;</> : 'Claim at'}</th>
                {colAges.map((b) => <th key={b} scope="col">{head(couple ? 1 : 0, b)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rowAges.map((a) => (
                <tr key={a ?? 'one'}>
                  <th scope="row">{couple ? head(0, a) : 'You'}</th>
                  {colAges.map((b) => {
                    const ages = agesAt(a, b);
                    const c = cellOf(ages);
                    const idx = strategies.findIndex((s) => sameAges(s.claimAges, ages));
                    const cls = [sameAges(ages, planAges) && 'plan-cell', picked && sameAges(ages, picked) && 'picked-cell'].filter(Boolean).join(' ');
                    return (
                      <td key={b} className={cls || undefined} style={shade(c)}>
                        <button type="button" className="link-button" onClick={() => choose(ages)} aria-pressed={idx >= 0}>
                          {idx >= 0 && <span className="ss-dot" style={{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }} aria-hidden="true" />}
                          {k(c.discountedTotal)}
                          {c === pairs.best ? ' ★' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Household lifetime benefits ({totalWord}){couple ? ': own, spousal and survivor' : ''}; darker = more. Headers: each person&rsquo;s own benefit a
          month at that age. ★ the most; dashed: the plan; a dot: compared below. Choose a cell to see its benefits and add it to the comparison.
        </p>
        {pickedCell && (
          <div className="ss-panel">
            <h3>{strategyLabel(picked)}</h3>
            <table className="compare-table strategy-table">
              <thead>
                <tr>
                  {couple && <th scope="col">Who</th>}
                  <th scope="col">Own a month</th>
                  {couple && <th scope="col">Spousal a month</th>}
                  {couple && <th scope="col">Survivor a month</th>}
                  <th scope="col">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p, i) => {
                  const m = pickedCell.monthly[i];
                  const life = pickedCell.people[i];
                  return (
                    <tr key={p.id}>
                      {couple && <th scope="row">{WHO[p.id]} {picked[i] === null ? '(receiving)' : `at ${picked[i]}`}</th>}
                      <td>{$(m.own)}</td>
                      {couple && <td>{m.spousal > 0 ? $(m.spousal) : '—'}</td>}
                      {couple && <td>{m.survivor > 0 ? <>{$(m.survivor)} <span className="dim">after the first death</span></> : '—'}</td>}
                      <td>{$(life.own + life.spousal + life.survivor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="calc">
              <div className="calc-row total"><span>Household ({totalWord})</span><span>{$(pickedCell.discountedTotal)}</span></div>
              {!sameAges(picked, planAges) && <div className="calc-row sub"><span>Compared with the plan&rsquo;s ages</span><span>{signed(pickedCell.discountedTotal - plan.discountedTotal)}</span></div>}
              {pickedCell !== pairs.best && <div className="calc-row sub"><span>Compared with the most ({strategyLabel(pairs.best.claimAges)})</span><span>{signed(pickedCell.discountedTotal - pairs.best.discountedTotal)}</span></div>}
            </div>
            {couple && <p className="hint">Spousal: the top-up while both are alive, from the later of the two claims. Survivor: the top-up to the larger benefit, after the first death (at the plan&rsquo;s life expectancies).</p>}
            <div className="button-row">
              {onUse && !sameAges(picked, planAges) && (
                <button type="button" className="button secondary" onClick={() => applyAges(picked)}>
                  Use {strategyLabel(picked).toLowerCase()} in the plan
                </button>
              )}
              {clicked.some((x) => sameAges(resolve(x), picked)) && !sameAges(picked, pairs.best.claimAges) && (
                <button type="button" className="link-button" onClick={() => remove(picked)}>
                  Remove from the comparison
                </button>
              )}
            </div>
          </div>
        )}
      </>
    ),
  };

  // The strategies compared: the most, then the cells chosen (the plan's to start), each with its
  // line color; the dropdown picks one for the table year by year.
  const shownStrategy = strategies.find((s) => keyOf(s.claimAges) === shown) ?? strategies[0];
  const shownIndex = strategies.indexOf(shownStrategy);
  const strategyName = (s) => `${strategyLabel(s.claimAges)}${sameAges(s.claimAges, planAges) ? ' (the plan)' : ''}${s.cell === pairs.best ? ' ★ the most' : ''}`;
  const rows = shownStrategy ? strategyRows(shownStrategy.cell, { year: view.year, inflationRate, futureDollars }) : [];
  const firstPaid = rows.findIndex((r) => r.total > 0);
  const paidRows = firstPaid < 0 ? [] : rows.slice(firstPaid);
  const cols = people.flatMap((p, i) =>
    ['own', 'spousal', 'survivor']
      .filter((kind) => paidRows.some((r) => r.streams[i][kind] > 0))
      .map((kind) => ({ i, kind, label: `${couple ? `${WHO[p.id]}: ` : ''}${kind}` })),
  );
  const deathYear = (i) => people[i].birthYear + people[i].planToAge;
  const dollarsWord = futureDollars ? `future dollars, growing ${formatPercent(inflationRate, 1)} a year` : 'today’s dollars';
  const yearsBlock = shownStrategy && {
    id: 'years',
    title: 'Year by year',
    summary: `${strategyLabel(shownStrategy.claimAges)}: ${paidRows.length ? `${$(paidRows[0].total)} in ${paidRows[0].year}, ` : ''}${$(rows.at(-1)?.cumulative ?? 0)} in all (${futureDollars ? 'future' : 'today’s'} dollars)`,
    content: (
      <>
        <div className="ss-controls">
          <label>
            Strategy{' '}
            <select value={keyOf(shownStrategy.claimAges)} onChange={(e) => setShown(e.target.value)}>
              {strategies.map((s) => <option key={keyOf(s.claimAges)} value={keyOf(s.claimAges)}>{strategyName(s)}</option>)}
            </select>
          </label>
          <label>
            Dollars{' '}
            <select value={futureDollars ? 'future' : 'today'} onChange={(e) => setFutureDollars(e.target.value === 'future')}>
              <option value="today">Today&rsquo;s dollars</option>
              <option value="future">Future dollars ({formatPercent(inflationRate, 1)} a year)</option>
            </select>
          </label>
        </div>
        <div className="table-scroll ss-years">
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">{couple ? 'Ages' : 'Age'}</th>
                {cols.map((c) => <th key={`${c.i}-${c.kind}`} scope="col">{c.label}</th>)}
                <th scope="col">{couple ? 'Household' : 'Benefit'}</th>
                <th scope="col">Running total</th>
              </tr>
            </thead>
            <tbody>
              {paidRows.map((r) => (
                <tr key={r.year} className={shownStrategy.cell.firstDeath >= 0 && r.year > deathYear(shownStrategy.cell.firstDeath) ? 'survivor-row' : undefined}>
                  <th scope="row">{r.year}</th>
                  <td>{r.ages.map((a, i) => (r.year > deathYear(i) ? '—' : a)).join(' / ')}</td>
                  {cols.map((c) => <td key={`${c.i}-${c.kind}`}>{r.streams[c.i][c.kind] > 0 ? $(r.streams[c.i][c.kind]) : '—'}</td>)}
                  <td>{$(r.total)}</td>
                  <td>{$(r.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Each year&rsquo;s benefits before tax, in {dollarsWord}, not discounted{firstPaid > 0 ? `; from the first year paid (${paidRows[0].year})` : ''}, to
          {couple ? ' the second death' : ` age ${people[0].planToAge}`} at the plan&rsquo;s life expectancies{couple ? ' (survivor years shaded)' : ''}. Choose cells in the grid to add strategies.
        </p>
      </>
    ),
  };

  // The break-even graph: each strategy's running total by your age (today's dollars, at the
  // discount rate); dashed lines where another strategy crosses the one chosen in Year by year.
  const starts = strategies.map((s) => s.curve.findIndex((p) => p.y > 0)).filter((i) => i >= 0);
  const from = starts.length ? Math.max(0, Math.min(...starts) - 1) : 0;
  const yourAge = (x) => (couple ? `your age ${ageText(x)} (your spouse ${ageText(x + people[0].birthYear - people[1].birthYear)})` : `age ${ageText(x)}`);
  const crossRows = compared.crossings.map((x) => ({ ...x, behind: x.leader === x.a ? x.b : x.a }));
  const passes = (x) => `${strategyLabel(strategies[x.leader].claimAges)} passes ${strategyLabel(strategies[x.behind].claimAges).toLowerCase()}`;
  const breakEvenBlock = strategies.length > 0 && {
    id: 'break-even',
    title: 'Break-even',
    summary:
      strategies.length < 2
        ? 'Choose cells in the grid to compare strategies'
        : crossRows.length
          ? `${passes(crossRows[0])} at ${yourAge(crossRows[0].age)}`
          : 'No crossings: one strategy stays ahead',
    content: (
      <>
        <LineChart
          series={strategies.map((s) => ({ key: keyOf(s.claimAges), label: strategyName(s), points: s.curve.slice(from) }))}
          xTicks={strategies[0].curve.slice(from).map((p) => p.x)}
          formatX={(a) => (couple ? `Your age ${a}` : `Age ${a}`)}
          formatXTick={(a) => `${a}`}
          formatY={(y) => $(y)}
          formatYTick={k}
          xLabel={couple ? 'Your age' : 'Age'}
          yLabel={`Running total (${totalWord})`}
          markers={false}
          yFloor={0}
          refLines={crossRows
            .filter((x) => x.a === shownIndex || x.b === shownIndex)
            .map((x) => ({ x: x.age, label: `${strategyLabel(strategies[x.leader].claimAges)} ahead from ${ageText(x.age)}` }))}
        />
        {crossRows.length > 0 && (
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col">Crossing</th>
                <th scope="col">At</th>
              </tr>
            </thead>
            <tbody>
              {crossRows.map((x) => (
                <tr key={`${x.a}-${x.b}-${x.age}`}>
                  <th scope="row">{passes(x)}</th>
                  <td>{yourAge(x.age)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint">
          Household benefits received by each age ({totalWord}){couple ? ': own, spousal and survivor, by your age' : ''}. A later claim pays off once its line
          crosses an earlier one; dashed: the crossings with {shownStrategy ? strategyLabel(shownStrategy.claimAges).toLowerCase() : 'the strategy'} (the one chosen
          in Year by year). Today&rsquo;s dollars only: future dollars would move the crossings, as a discount rate does.
        </p>
      </>
    ),
  };

  // The chart's markers: each person's life expectancy in the plan, and their widest break-even
  // (the first open age vs. 70), merged when both people share one.
  const refLines = [];
  if (survival) {
    survival.reach.forEach((r, i) => {
      const who = couple ? `${WHO[people[i].id]}: ` : '';
      const widest = r.marks.filter((m) => m.kind === 'breakEven').at(-1);
      if (widest) {
        const same = refLines.find((l) => l.kind === 'breakEven' && Math.abs(l.x - widest.age) < 0.05);
        if (same) same.label = `Break-even ${widest.label}`;
        else refLines.push({ kind: 'breakEven', x: widest.age, label: `${who}break-even ${widest.label}` });
      }
      refLines.push({ kind: 'planTo', x: people[i].planToAge, label: `${who}life expectancy ${people[i].planToAge}` });
    });
  }
  const sexWord = (sex) => (sex === 'male' ? 'men' : sex === 'female' ? 'women' : 'men and women averaged');
  const aliveBlock = survival && {
    id: 'alive',
    title: 'The chance of being alive at each age',
    summary: survival.reach
      .map((r, i) => {
        const m = r.marks.find((x) => x.kind === 'planTo');
        return `${couple ? `${WHO[r.id]}: ` : ''}${formatPercent(m.chance, 0)} chance of reaching ${people[i].planToAge}`;
      })
      .join(' · '),
    content: (
      <>
        <LineChart
          series={survival.series.map((s) => ({ key: s.id, label: couple ? WHO[s.id] : 'You', points: s.points }))}
          xTicks={survival.ages}
          formatX={(a) => `Age ${a}`}
          formatXTick={(a) => `${a}`}
          formatY={(y) => formatPercent(y, 0)}
          xLabel="Age"
          yLabel="Chance of being alive"
          markers={false}
          yFloor={0}
          yCeil={1}
          refLines={refLines}
        />
        <table className="compare-table strategy-table">
          <thead>
            <tr>
              {couple && <th scope="col">Who</th>}
              <th scope="col">Reaching</th>
              <th scope="col">Age</th>
              <th scope="col">Chance</th>
            </tr>
          </thead>
          <tbody>
            {survival.reach.flatMap((r) =>
              r.marks.map((m) => (
                <tr key={`${r.id}-${m.kind}-${m.label}`}>
                  {couple && <th scope="row">{WHO[r.id]}</th>}
                  <td>{m.kind === 'planTo' ? 'Life expectancy in the plan' : `Break-even, claiming at ${m.label}`}</td>
                  <td>{ageText(m.age)}</td>
                  <td>{formatPercent(m.chance, 0)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
        <p className="hint">
          From SSA&rsquo;s period life table ({people.map((p) => `${couple ? `${WHO[p.id].toLowerCase()}: ` : ''}${sexWord(p.sex)}`).join(', ')}), from each
          person&rsquo;s age now. A later claim pays off only for someone alive past the break-even age; a survivor benefit can carry it
          further for a couple.{people.some((p) => p.sex !== 'male' && p.sex !== 'female') && ' Enter sex on the inputs page for the table by sex.'}
        </p>
      </>
    ),
  };

  return (
    <Blocks
      blocks={[
        { id: 'plan', title: 'Lifetime Social Security', summary: h.plan, className: 'key-card', content: summary },
        gridBlock,
        yearsBlock,
        breakEvenBlock,
        ...tables.map(personBlock),
        aliveBlock,
      ]}
      disclaimer="Estimates only — not tax or financial advice. Gross benefits in today’s dollars (future dollars as an option year by year). SSA’s rules for reductions, delayed credits, spousal and survivor benefits; not modeled: the earnings test, benefits for children or ex-spouses."
    />
  );
}
