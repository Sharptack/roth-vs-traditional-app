// The tax page's two buckets (round 2 phase 1; design in the plan doc's decision tables): one
// vertical income scale, and beside it two buckets filled to today's income and drawn on through
// the next two brackets. Left, the marginal rate bucket: the tax bracket at each income level, the
// sheltered part grey, the room left in today's bracket marked. Right, the effective marginal rate
// (EMTR) bucket:
// the real tax on the next dollar at each level, labelled where it changes, with IRMAA cliffs as
// plain lines and a key under the chart with each cliff's amount (decided 2026-10-09). A switch
// shows the next dollar as ordinary income or as capital gains. Renders
// lib/rateProfile.js; no math of its own.
import { useMemo, useState } from 'react';
import { formatCurrency as $, formatPercent } from '../lib/format.js';
import { rateProfile } from '../lib/rateProfile.js';

const pct = (r, d = 1) => formatPercent(r, d);
const SOURCES = [
  { value: 'ordinaryIncome', label: 'Ordinary income', hint: 'a Pre-tax withdrawal, a pension, a Roth conversion, more pay (payroll tax left out)' },
  { value: 'preferentialIncome', label: 'Capital gains', hint: 'a long-term gain: a house sale, a taxable account sold off' },
];

// Geometry: the income scale on the left, set apart; the two buckets with the room left between
// them; room on the right for labels.
const W = 880;
const Y0 = 64;
const PLOT_H = 470;
const SCALE_X = 132; // income labels end here
const BW = 210; // bucket width
const LX = 168; // marginal bucket
const RX = 548; // effective bucket
const MAX_RATE = 0.6; // a full bucket width
const LINE = 16; // the least gap between two labels in the right margin

// Right-margin labels, most important first, each moved down (then up) just enough to clear the
// ones already placed.
function spread(items) {
  const placed = [];
  for (const it of items) {
    let y = it.y;
    for (let k = 1; placed.some((p) => Math.abs(p.y - y) < LINE) && k < 40; k++) y = it.y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * LINE;
    placed.push({ ...it, y });
  }
  return placed;
}

// Runs of rows with the same value of `key` (within half a basis point), each split at today.
function runsOf(rows, step, today, key) {
  const runs = [];
  for (const r of rows) {
    const below = r.income < today - 1e-6;
    const value = key === 'bracket' && r.sheltered ? -1 : r[key];
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.value - value) < 0.00005 && last.below === below) last.to = r.income + step;
    else runs.push({ value, from: r.income, to: r.income + step, below });
  }
  return runs;
}

export default function RateBuckets({ params, irmaa, ages }) {
  const [source, setSource] = useState('ordinaryIncome');
  const profile = useMemo(() => rateProfile(params, { source, irmaa, ages }), [params, source, irmaa, ages]);
  const { rows, step, today, top, now } = profile;
  const y = (d) => Y0 + PLOT_H - (Math.min(d, top) / top) * PLOT_H;
  const w = (r) => (Math.max(0, Math.min(r, MAX_RATE)) / MAX_RATE) * BW;
  const H = Y0 + PLOT_H + 56;

  const marginal = runsOf(rows, step, today, 'bracket');
  const effective = runsOf(rows, step, today, 'nextRate');

  // Income scale: $0, each bracket edge, today, the top; a label too close to one already placed
  // is dropped (today's always stays).
  const tickValues = [0, ...profile.edges.map((e) => e.income), top];
  const ticks = [];
  for (const v of [today, ...tickValues]) if (!ticks.some((t) => Math.abs(y(t) - y(v)) < 18)) ticks.push(v);

  const cliffs = rows.filter((r) => r.irmaaJump > 0.5);
  // Effective-rate labels: where the rate changes and the run is tall enough to read, or a spike;
  // never on an IRMAA line or today's line.
  const labels = [];
  const busy = [y(today), ...cliffs.map((c) => y(c.income + step))];
  effective.forEach((r, i) => {
    const h = y(r.from) - y(r.to);
    const prev = effective[i - 1];
    const next = effective[i + 1];
    const spike = prev && next && r.value > prev.value + 0.03 && r.value > next.value + 0.03;
    if ((h >= 16 || spike) && r.value > 0.0005) {
      const mid = (y(r.from) + y(r.to)) / 2;
      const same = labels[labels.length - 1];
      if (same && Math.abs(same.value - r.value) < 0.0005) return;
      if (!labels.some((l) => Math.abs(l.y - mid) < 16) && !busy.some((b) => Math.abs(b - mid) < 12)) labels.push({ y: mid, value: r.value, x: RX + w(r.value) + 6 });
    }
  });

  // The right margin: the next dollar first, then effective-rate labels that run past the bucket
  // (the IRMAA cliffs are in the key below the chart).
  const margin = spread([
    { key: 'next', y: y(today) - 6, text: `next dollar: ${pct(profile.now.nextRate)}`, className: 'rb-label rb-strong' },
    ...labels.filter((l) => l.x >= RX + BW).map((l) => ({ key: `el${l.y}`, y: l.y + 4, text: `${pct(l.value)}${l.value > MAX_RATE ? ' ›' : ''}`, className: 'rb-label rb-eff' })),
  ]);
  const inside = labels.filter((l) => l.x < RX + BW);

  // The room left in today's bracket: from today to where the bracket next changes, on the chart.
  const nextEdge = marginal.find((r) => r.from > today + step / 2 && r.value !== marginal.find((m) => m.from <= today && today < m.to + 1e-6)?.value);
  const yToday = y(today);
  const room = now.nextBracket === null ? null : now.room;

  return (
    <figure className="rate-buckets">
      <div className="radio-options rate-buckets-switch" role="radiogroup" aria-label="The next dollar is">
        <span className="dim">The next dollar is</span>
        {SOURCES.map((s) => (
          <label key={s.value} className="radio" title={s.hint}>
            <input type="radio" name="rate-buckets-source" value={s.value} checked={source === s.value} onChange={() => setSource(s.value)} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Today's income ${$(today)}: ${pct(now.bracket, 0)} bracket, ${pct(now.nextRate)} on the next dollar`}>
        <text x={LX + BW / 2} y={22} textAnchor="middle" className="rb-head">Marginal rate</text>
        <text x={LX + BW / 2} y={40} textAnchor="middle" className="rb-sub">{source === 'preferentialIncome' ? 'the capital-gains bracket' : 'the tax bracket'}</text>
        <text x={RX + BW / 2} y={22} textAnchor="middle" className="rb-head rb-eff">Effective marginal rate</text>
        <text x={RX + BW / 2} y={40} textAnchor="middle" className="rb-sub">EMTR: the real tax on the next dollar</text>

        {/* the marginal bucket */}
        {marginal.map((r) => {
          const top2 = y(r.to);
          const h = y(r.from) - top2;
          if (r.value < 0) return <rect key={`m${r.from}`} x={LX} y={top2} width={BW} height={h} className="rb-sheltered" opacity={r.below ? 1 : 0.5} />;
          return <rect key={`m${r.from}`} x={LX} y={top2} width={w(r.value)} height={h} className={r.below ? 'rb-marginal' : 'rb-marginal rb-above'} />;
        })}
        {marginal.map((r, i) => {
          const prev = marginal[i - 1];
          if (prev && prev.value === r.value) return null; // one label per bracket
          let end = r.to;
          for (let j = i + 1; j < marginal.length && marginal[j].value === r.value; j++) end = marginal[j].to;
          const mid = (y(r.from) + y(end)) / 2;
          if (y(r.from) - y(end) < 14) return null;
          return (
            <text key={`ml${r.from}`} x={r.value < 0 ? LX + 10 : LX + w(r.value) + 6} y={mid + 4} className={r.value < 0 ? 'rb-label rb-dim' : 'rb-label'}>
              {r.value < 0 ? 'Sheltered: 0%' : pct(r.value, 0)}
            </text>
          );
        })}

        {/* the effective bucket */}
        {effective.map((r) => {
          if (r.value <= 0.00005) {
            const sheltered = rows.find((x) => x.income >= r.from)?.sheltered;
            return sheltered ? <rect key={`e${r.from}`} x={RX} y={y(r.to)} width={BW} height={y(r.from) - y(r.to)} className="rb-sheltered" opacity={r.below ? 1 : 0.5} /> : null;
          }
          return <rect key={`e${r.from}`} x={RX} y={y(r.to)} width={w(r.value)} height={y(r.from) - y(r.to)} className={r.below ? 'rb-effective' : 'rb-effective rb-above'} />;
        })}
        {inside.map((l) => (
          <text key={`el${l.y}`} x={l.x} y={l.y + 4} className="rb-label rb-eff">
            {pct(l.value)}
          </text>
        ))}
        {cliffs.map((r) => (
          <line key={`c${r.income}`} x1={RX} x2={RX + BW} y1={y(r.income + step)} y2={y(r.income + step)} className="rb-cliff" />
        ))}
        {margin.map((m) => (
          <text key={m.key} x={RX + BW + 8} y={m.y} className={m.className}>
            {m.text}
          </text>
        ))}

        {/* bucket walls, open at the top */}
        {[LX, RX].map((x) => (
          <path key={`wall${x}`} d={`M${x} ${Y0 - 8} V${y(0)} H${x + BW} V${Y0 - 8}`} className="rb-wall" />
        ))}

        {/* the income scale, set apart on the left */}
        <line x1={SCALE_X + 14} x2={SCALE_X + 14} y1={Y0 - 8} y2={y(0)} className="rb-axis" />
        {ticks.map((v) => (
          <g key={`t${v}`}>
            <line x1={SCALE_X + 8} x2={SCALE_X + 14} y1={y(v)} y2={y(v)} className="rb-axis" />
            <text x={SCALE_X} y={y(v) + 5} textAnchor="end" className={v === today ? 'rb-tick rb-today-text' : 'rb-tick'}>
              {$(v)}
            </text>
          </g>
        ))}
        <text x={SCALE_X} y={22} textAnchor="end" className="rb-head">Total income</text>

        {/* today: the line across both, the room, the next dollar */}
        <line x1={SCALE_X + 14} x2={RX + BW + 10} y1={yToday} y2={yToday} className="rb-today" />
        {room !== null && nextEdge && (
          <g>
            <path d={`M${LX + BW + 10} ${yToday} V${y(nextEdge.from)}`} className="rb-room" />
            <text x={LX + BW + 18} y={yToday - 22} className="rb-label rb-strong">{$(room)} of room</text>
            <text x={LX + BW + 18} y={yToday - 7} className="rb-label rb-dim">before {pct(now.nextBracket, 0)}</text>
          </g>
        )}
        <text x={(LX + RX + BW) / 2} y={y(0) + 30} textAnchor="middle" className="rb-sub">
          Width = tax rate (a full bucket is {pct(MAX_RATE, 0)}). Below today&rsquo;s line: your income as it is; above it: more {source === 'preferentialIncome' ? 'capital gains' : 'ordinary income'}.
        </text>
      </svg>
      {cliffs.length > 0 && (
        <p className="rb-key">
          <span>
            <span className="rb-key-swatch" aria-hidden="true" />
            Medicare IRMAA tiers:
          </span>
          {cliffs.map((c, i) => (
            <span key={`k${c.income}`} className="dim">
              above {$(c.income + step)}: +{$(c.irmaaJump)} per year{i < cliffs.length - 1 ? ';' : ''}
            </span>
          ))}
        </p>
      )}
      <figcaption className="hint">
        The left bucket is the bracket (the marginal rate). The right one is the effective marginal rate: what the next dollar
        really costs in federal income tax, counting
        everything it sets off: Social Security made taxable, gains pushed out of the 0% rate, deductions phasing out, the Net
        Investment Income Tax. Red lines are Medicare IRMAA tiers: one dollar over raises the premium two years later by the
        amount in the key. Payroll tax is in the calculation above.
      </figcaption>
    </figure>
  );
}
