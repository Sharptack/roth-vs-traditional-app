// The Social Security calculator's results (phase 5): the household's lifetime benefits under the
// plan's claiming ages and the best pair; the claiming strategy grid of every pair (one row for one
// person), its selected cell set beside the most; the selected or the most year by year (a stacked
// bar chart, the table under it); two strategies of any claiming ages on a break-even graph; and the
// chance of being alive, with a couple's joint odds (reworked 2026-10-16, asked by Michael).
// Renders lib/socialSecurityCalculator.js's view; no math of its own. onUse(personId, age): "Use in
// the plan" (absent: view only).
import { useState } from 'react';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { socialSecurityHeadlines } from '../lib/blockHeadlines.js';
import { strategyCompare } from '../lib/socialSecurityCalculator.js';
import { strategyRows } from '../lib/socialSecurityLifetime.js';
import Blocks from './Blocks.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import StackedBarChart from '../components/charts/StackedBarChart.jsx';

export const WHO = { p1: 'You', p2: 'Your spouse' };
const whose = { p1: 'Your', p2: 'Your spouse’s' };
const k = (x) => `$${Math.round(x / 1000).toLocaleString('en-US')}k`;
const signed = (x) => `${x >= 0 ? '+' : '−'}${$(Math.abs(x))}`;
const sameAges = (x, y) => x.length === y.length && x.every((a, i) => a === y[i]);
const keyOf = (ages) => ages.map((a) => a ?? 'now').join('-');
const ageText = (a) => {
  if (a === null) return 'never (by 119)';
  const months = Math.round((a % 1) * 12);
  const years = Math.floor(a) + (months === 12 ? 1 : 0);
  return months % 12 ? `${years} and ${months} months` : `${years}`;
};

// survival: survivalView's chance of being alive at each age (null: no chart).
export default function SocialSecurityResult({ view, survival, onUse }) {
  const [picked, setPicked] = useState(null); // the grid's selected claiming ages (null: the plan's)
  const [shown, setShown] = useState('selected'); // Year by year: 'selected' or 'best'
  const [futureDollars, setFutureDollars] = useState(false);
  const [custom, setCustom] = useState([null, null]); // Break-even's two strategies (null: the most, the selected)
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
  const strategyLabel = (ages) =>
    couple ? `You ${ages[0] ?? 'now'}, your spouse ${ages[1] ?? 'now'}` : ages[0] === null ? 'Receiving now' : `Claim at ${ages[0]}`;
  const cellOf = (ages) => pairs.cells.find((c) => sameAges(c.claimAges, ages));
  const selected = picked && cellOf(picked) ? picked : planAges;
  const selectedCell = cellOf(selected);
  const tags = (ages) =>
    [sameAges(ages, selected) && 'selected', sameAges(ages, pairs.best.claimAges) && 'the most', sameAges(ages, planAges) && 'the plan'].filter(Boolean);
  const strategyName = (ages) => `${strategyLabel(ages)}${tags(ages).length ? ` (${tags(ages).join(', ')})` : ''}`;

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

  // The claiming strategy grid (before phase 6, asked 2026-10-12; renamed and reworked 2026-10-16):
  // your claiming age down the side, your spouse's across (one row for one person), each header with
  // that person's monthly benefit; cells shaded by the household total. Choosing a cell selects it
  // (the plan's to start), set beside the most below the grid.
  const rowAges = couple ? pairs.ages[0] : [undefined];
  const colAges = couple ? pairs.ages[1] : pairs.ages[0];
  const agesAt = (a, b) => (couple ? [a, b] : [b]);
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
  const select = (ages) => {
    setPicked(ages);
    setShown('selected');
  };
  // The selected strategy beside the most: each person's monthly benefits and lifetime, the household.
  const sideBySide = [selectedCell, ...(selectedCell === pairs.best ? [] : [pairs.best])];
  const anyOf = (i, kind) => sideBySide.some((c) => c.monthly[i][kind] > 0);
  const compareRows = people.flatMap((p, i) => {
    const who = couple ? `${WHO[p.id]}: ` : '';
    return [
      { key: `${p.id}-age`, label: `${who}claim at`, value: (c) => (c.claimAges[i] === null ? 'receiving' : `${c.claimAges[i]}`) },
      { key: `${p.id}-own`, label: `${who}own a month`, value: (c) => $(c.monthly[i].own) },
      ...(couple && anyOf(i, 'spousal') ? [{ key: `${p.id}-spousal`, label: `${who}spousal a month`, value: (c) => (c.monthly[i].spousal > 0 ? $(c.monthly[i].spousal) : '—') }] : []),
      ...(couple && anyOf(i, 'survivor') ? [{ key: `${p.id}-survivor`, label: `${who}survivor a month, after the first death`, value: (c) => (c.monthly[i].survivor > 0 ? $(c.monthly[i].survivor) : '—') }] : []),
      ...(couple ? [{ key: `${p.id}-life`, label: `${who}lifetime`, value: (c) => $(c.people[i].own + c.people[i].spousal + c.people[i].survivor) }] : []),
    ];
  });
  const gridBlock = pairs.cells.length > 1 && {
    id: 'grid',
    title: 'Claiming strategy',
    summary:
      selectedCell === pairs.best
        ? `${strategyLabel(selected)}: the most, ${$(pairs.best.discountedTotal)}`
        : `${strategyLabel(selected)}: ${$(selectedCell.discountedTotal)}, ${$(pairs.best.discountedTotal - selectedCell.discountedTotal)} less than the most (${strategyLabel(pairs.best.claimAges).toLowerCase()})`,
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
                    const on = sameAges(ages, selected);
                    const cls = [sameAges(ages, planAges) && 'plan-cell', on && 'picked-cell'].filter(Boolean).join(' ');
                    return (
                      <td key={b} className={cls || undefined} style={shade(c)}>
                        <button type="button" className="link-button" onClick={() => select(ages)} aria-pressed={on}>
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
          month at that age. ★ the most; dashed: the plan; solid outline: selected (the plan&rsquo;s to start). Choose a cell to select it.
        </p>
        <div className="ss-panel">
          <h3>{selectedCell === pairs.best ? 'Selected: the most' : 'Selected vs. the most'}</h3>
          <table className="compare-table strategy-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Figure</span></th>
                <th scope="col">Selected{sameAges(selected, planAges) ? ' (the plan)' : ''}</th>
                {selectedCell !== pairs.best && <th scope="col">The most{sameAges(pairs.best.claimAges, planAges) ? ' (the plan)' : ''}</th>}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  {sideBySide.map((c) => <td key={keyOf(c.claimAges)}>{r.value(c)}</td>)}
                </tr>
              ))}
              <tr className="total-row">
                <th scope="row">Household ({totalWord})</th>
                {sideBySide.map((c) => <td key={keyOf(c.claimAges)}>{$(c.discountedTotal)}</td>)}
              </tr>
            </tbody>
          </table>
          {selectedCell !== pairs.best && (
            <div className="calc">
              <div className="calc-row total"><span>The selected compared with the most</span><span>{signed(selectedCell.discountedTotal - pairs.best.discountedTotal)}</span></div>
            </div>
          )}
          {couple && <p className="hint">Spousal: the top-up while both are alive, from the later of the two claims. Survivor: the top-up to the larger benefit, after the first death (at the plan&rsquo;s life expectancies).</p>}
          {onUse && (
            <div className="button-row">
              {!sameAges(selected, planAges) && (
                <button type="button" className="button secondary" onClick={() => applyAges(selected)}>
                  Use the selected ({strategyLabel(selected).toLowerCase()}) in the plan
                </button>
              )}
              {selectedCell !== pairs.best && !sameAges(pairs.best.claimAges, planAges) && (
                <button type="button" className="link-button" onClick={() => applyAges(pairs.best.claimAges)}>
                  Use the most in the plan
                </button>
              )}
            </div>
          )}
        </div>
      </>
    ),
  };

  // Year by year: the selected strategy or the most, each person's benefits stacked a year, the
  // table under the chart (opened on demand).
  const options = [
    { id: 'selected', cell: selectedCell, label: `Selected: ${strategyName(selected)}` },
    ...(selectedCell === pairs.best ? [] : [{ id: 'best', cell: pairs.best, label: `The most: ${strategyName(pairs.best.claimAges)}` }]),
  ];
  const shownOption = options.find((o) => o.id === shown) ?? options[0];
  const shownCell = shownOption.cell;
  const rows = strategyRows(shownCell, { year: view.year, inflationRate, futureDollars });
  const firstPaid = rows.findIndex((r) => r.total > 0);
  const paidRows = firstPaid < 0 ? [] : rows.slice(firstPaid);
  const cols = people.flatMap((p, i) =>
    ['own', 'spousal', 'survivor']
      .filter((kind) => paidRows.some((r) => r.streams[i][kind] > 0))
      .map((kind) => ({ i, kind, label: `${couple ? `${WHO[p.id]}: ` : ''}${kind}` })),
  );
  const deathYear = (i) => people[i].birthYear + people[i].planToAge;
  const survivorFrom = shownCell.firstDeath >= 0 ? deathYear(shownCell.firstDeath) + 1 : null;
  const personTotal = (r, i) => r.streams[i].own + r.streams[i].spousal + r.streams[i].survivor;
  const dollarsWord = futureDollars ? `future dollars, growing ${formatPercent(inflationRate, 1)} a year` : 'today’s dollars';
  const yearsBlock = {
    id: 'years',
    title: 'Year by year',
    summary: `${strategyLabel(shownCell.claimAges)}: ${paidRows.length ? `${$(paidRows[0].total)} in ${paidRows[0].year}, ` : ''}${$(rows.at(-1)?.cumulative ?? 0)} in all (${futureDollars ? 'future' : 'today’s'} dollars)`,
    content: (
      <>
        <div className="ss-controls">
          {options.length > 1 && (
            <label>
              Strategy{' '}
              <select value={shownOption.id} onChange={(e) => setShown(e.target.value)}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          )}
          <label>
            Dollars{' '}
            <select value={futureDollars ? 'future' : 'today'} onChange={(e) => setFutureDollars(e.target.value === 'future')}>
              <option value="today">Today&rsquo;s dollars</option>
              <option value="future">Future dollars ({formatPercent(inflationRate, 1)} a year)</option>
            </select>
          </label>
        </div>
        {options.length === 1 && <p className="hint">{options[0].label}.</p>}
        {paidRows.length > 0 && (
          <StackedBarChart
            x={paidRows.map((r) => r.year)}
            stacks={people.map((p, i) => ({ key: p.id, label: couple ? WHO[p.id] : 'Your benefit', color: `var(--series-${i + 1})`, values: paidRows.map((r) => personTotal(r, i)) }))}
            shadeFrom={couple && survivorFrom !== null && paidRows.some((r) => r.year === survivorFrom) ? { x: survivorFrom, label: 'Survivor years' } : undefined}
            formatX={(v) => `${v}`}
            formatY={(v) => $(v)}
            formatYTick={k}
            xLabel="Year"
            yLabel={`Benefits a year (${futureDollars ? 'future' : 'today’s'} dollars)`}
          />
        )}
        <details className="details">
          <summary>The table, year by year</summary>
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
                  <tr key={r.year} className={survivorFrom !== null && r.year >= survivorFrom ? 'survivor-row' : undefined}>
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
        </details>
        <p className="hint">
          Each year&rsquo;s benefits before tax, in {dollarsWord}, not discounted{firstPaid > 0 ? `; from the first year paid (${paidRows[0].year})` : ''}, to
          {couple ? ' the second death' : ` age ${people[0].planToAge}`} at the plan&rsquo;s life expectancies{couple ? '; each person’s own, spousal and survivor benefits together (survivor years shaded)' : ''}.
          Select a cell in the claiming strategy grid to change the selected strategy.
        </p>
      </>
    ),
  };

  // Break-even (reworked 2026-10-16): two strategies, each person's claiming age chosen for each;
  // the most and the selected to start. Their running totals by your age (today's dollars, at the
  // discount rate), dashed where they cross.
  const defaults = [pairs.best.claimAges, selected];
  const sides = custom.map((c, j) => c ?? defaults[j]);
  const setSide = (j, i, age) => setCustom((list) => list.map((c, jj) => (jj === j ? sides[j].map((a, ii) => (ii === i ? age : a)) : c)));
  const compared = strategyCompare(view, sides);
  const [sa, sb] = compared.strategies;
  const same = sameAges(sides[0], sides[1]);
  const yourAge = (x) => (couple ? `your age ${ageText(x)} (your spouse ${ageText(x + people[0].birthYear - people[1].birthYear)})` : `age ${ageText(x)}`);
  const sideName = (j) => `Strategy ${j + 1}`;
  const starts = compared.strategies.map((s) => s.curve.findIndex((p) => p.y > 0)).filter((i) => i >= 0);
  const from = starts.length ? Math.max(0, Math.min(...starts) - 1) : 0;
  const crossText = compared.crossings.map((x) => `${sideName(x.leader)} pulls ahead at ${yourAge(x.age)}`);
  const ahead = sa.cell.discountedTotal >= sb.cell.discountedTotal ? 0 : 1;
  const verdict = same
    ? 'The two strategies are the same; change a claiming age to compare.'
    : crossText.length
      ? `${crossText.join('; then ')}.`
      : `${sideName(compared.strategies[0].curve.at(-1).y >= compared.strategies[1].curve.at(-1).y ? 0 : 1)} stays ahead throughout: no break-even.`;
  const picker = (j) => (
    <fieldset key={j} className="ss-strategy">
      <legend>
        <span className="ss-swatch" style={{ background: `var(--series-${j + 1})` }} aria-hidden="true" /> {sideName(j)}
        {tags(sides[j]).length > 0 && <span className="dim"> ({tags(sides[j]).join(', ')})</span>}
      </legend>
      {people.map((p, i) => (
        <label key={p.id}>
          {couple ? WHO[p.id] : 'Claim at'}{' '}
          <select value={sides[j][i] ?? 'now'} onChange={(e) => setSide(j, i, e.target.value === 'now' ? null : Number(e.target.value))}>
            {pairs.ages[i].map((a) => <option key={a ?? 'now'} value={a ?? 'now'}>{a ?? 'receiving'}</option>)}
          </select>
        </label>
      ))}
      <span className="ss-strategy-total">{$(compared.strategies[j].cell.discountedTotal)} <span className="dim">in all</span></span>
    </fieldset>
  );
  const breakEvenBlock = {
    id: 'break-even',
    title: 'Break-even',
    summary: same ? 'Two strategies to compare' : `${strategyLabel(sides[1])} vs. ${strategyLabel(sides[0]).toLowerCase()}: ${crossText[0] ?? 'no break-even'}`,
    content: (
      <>
        <div className="ss-strategies">{[0, 1].map(picker)}</div>
        {custom.some(Boolean) && (
          <button type="button" className="link-button" onClick={() => setCustom([null, null])}>
            Back to the most vs. the selected
          </button>
        )}
        <p className="rate-lean">
          <strong>{verdict}</strong>
          {!same && <> Over both lifetimes: {sideName(ahead)} by {$(Math.abs(sa.cell.discountedTotal - sb.cell.discountedTotal))} ({totalWord}).</>}
        </p>
        <LineChart
          series={compared.strategies.map((s, j) => ({ key: `s${j}`, label: `${sideName(j)}: ${strategyLabel(s.claimAges)}`, points: s.curve.slice(from), color: `var(--series-${j + 1})` }))}
          xTicks={sa.curve.slice(from).map((p) => p.x)}
          formatX={(a) => (couple ? `Your age ${a}` : `Age ${a}`)}
          formatXTick={(a) => `${a}`}
          formatY={(y) => $(y)}
          formatYTick={k}
          xLabel={couple ? 'Your age' : 'Age'}
          yLabel={`Running total (${totalWord})`}
          markers={false}
          yFloor={0}
          refLines={compared.crossings.map((x) => ({ x: x.age, label: `${sideName(x.leader)} ahead from ${ageText(x.age)}` }))}
        />
        <p className="hint">
          Household benefits received by each age ({totalWord}){couple ? ': own, spousal and survivor, by your age' : ''}, at the plan&rsquo;s life expectancies.
          A later claim pays off once its line crosses the earlier one (dashed). Today&rsquo;s dollars only: future dollars would move the crossing, as a discount
          rate does.
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
  const joint = survival?.joint;
  const yearsWord = (y) => `${y.toFixed(1)} years`;
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
        {joint && (
          <>
            <h3 className="ss-joint-head">The two of you</h3>
            <div className="table-scroll">
              <table className="compare-table strategy-table">
                <thead>
                  <tr>
                    <th scope="col">Your age</th>
                    <th scope="col">Your spouse&rsquo;s age</th>
                    <th scope="col">You alive</th>
                    <th scope="col">Your spouse alive</th>
                    <th scope="col">Both alive</th>
                    <th scope="col">At least one alive</th>
                  </tr>
                </thead>
                <tbody>
                  {joint.rows.map((r) => (
                    <tr key={r.years}>
                      <th scope="row">{r.ages[0]}</th>
                      <td>{r.ages[1]}</td>
                      <td>{formatPercent(r.alive[0], 0)}</td>
                      <td>{formatPercent(r.alive[1], 0)}</td>
                      <td>{formatPercent(r.both, 0)}</td>
                      <td>{formatPercent(r.either, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="calc">
              <div className="calc-row"><span>Expected years until the first death</span><span>{yearsWord(joint.expected.first)}</span></div>
              <div className="calc-row"><span>Expected years until the second death (joint life expectancy)</span><span>{yearsWord(joint.expected.second)}</span></div>
            </div>
          </>
        )}
        <p className="hint">
          From SSA&rsquo;s period life table ({people.map((p) => `${couple ? `${WHO[p.id].toLowerCase()}: ` : ''}${sexWord(p.sex)}`).join(', ')}), from each
          person&rsquo;s age now. A later claim pays off only for someone alive past the break-even age; a survivor benefit can carry it
          further for a couple.{couple && ' The two of you: the two lives taken as independent; “at least one alive” is how long a survivor benefit may run.'}
          {people.some((p) => p.sex !== 'male' && p.sex !== 'female') && ' Enter sex on the inputs page for the table by sex.'}
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
        aliveBlock,
      ]}
      disclaimer="Estimates only — not tax or financial advice. Gross benefits in today’s dollars (future dollars as an option year by year). SSA’s rules for reductions, delayed credits, spousal and survivor benefits; not modeled: the earnings test, benefits for children or ex-spouses."
    />
  );
}
