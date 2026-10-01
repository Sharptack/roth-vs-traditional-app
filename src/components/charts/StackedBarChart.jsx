import { useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';
import { SERIES_COLORS } from './palette.js';

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 16, right: 20, bottom: 58, left: 72 };
const GAP = 2; // surface gap between stacked segments

// Hand-rolled SVG stacked bar chart (the projection page): one bar per x, segments stacked in the
// given order (they add up to a whole, e.g. gross income by source), an optional line on the SAME
// axis (e.g. total tax), a hover column with one tooltip per x, and a legend. Colors by series
// order (palette.js), never by rank. Callers add a "Show the numbers" table as the fallback.
//   x: [values]; stacks: [{ key, label, values }]; line: { key, label, values } (optional)
export default function StackedBarChart({ x, stacks, line, formatX, formatY, formatYTick = formatY, xLabel, yLabel }) {
  const [hover, setHover] = useState(null);
  const plotLeft = MARGIN.left;
  const plotRight = WIDTH - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;

  const totals = x.map((_, i) => stacks.reduce((s, st) => s + Math.max(0, st.values[i]), 0));
  const yMax = Math.max(1, ...totals, ...(line ? line.values : []));
  const yTicks = niceTicks(0, yMax * 1.05, 5);
  const yTop = Math.max(yMax, yTicks[yTicks.length - 1]);
  const yScale = linearScale([0, yTop], [plotBottom, plotTop]);
  const band = (plotRight - plotLeft) / x.length;
  const barW = Math.max(2, Math.min(28, band * 0.7));
  const cx = (i) => plotLeft + band * (i + 0.5);
  const labelEvery = Math.max(1, Math.ceil(x.length / 12));
  const color = (si) => stacks[si].color ?? SERIES_COLORS[si % SERIES_COLORS.length];

  return (
    <div className="chart-wrap">
      <div className="chart" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
          {yTicks.map((t) => (
            <g key={`grid-${t}`}>
              <line x1={plotLeft} x2={plotRight} y1={yScale(t)} y2={yScale(t)} className="chart-gridline" />
              <text x={plotLeft - 8} y={yScale(t)} className="chart-tick chart-tick-y" textAnchor="end" dominantBaseline="middle">
                {formatYTick(t)}
              </text>
            </g>
          ))}
          {x.map((v, i) =>
            i % labelEvery === 0 ? (
              <text key={`xt-${v}`} x={cx(i)} y={plotBottom + 20} className="chart-tick chart-tick-x" textAnchor="middle">
                {formatX(v)}
              </text>
            ) : null,
          )}
          {xLabel && (
            <text x={(plotLeft + plotRight) / 2} y={HEIGHT - 10} className="chart-axis-title" textAnchor="middle">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text transform={`translate(16, ${(plotTop + plotBottom) / 2}) rotate(-90)`} className="chart-axis-title" textAnchor="middle">
              {yLabel}
            </text>
          )}
          {hover !== null && (
            <rect x={cx(hover) - band / 2} y={plotTop} width={band} height={plotBottom - plotTop} className="chart-hover-band" />
          )}

          {x.map((v, i) => {
            let base = 0;
            const top = stacks.reduce((last, st, si) => (st.values[i] > 0 ? si : last), -1);
            return (
              <g key={`bar-${v}`}>
                {stacks.map((st, si) => {
                  const value = Math.max(0, st.values[i]);
                  if (!(value > 0)) return null;
                  const y0 = yScale(base);
                  const y1 = yScale(base + value);
                  base += value;
                  const h = Math.max(0, y0 - y1 - (si === top ? 0 : GAP));
                  const xLeft = cx(i) - barW / 2;
                  const yTopPx = y1 + (si === top ? 0 : GAP);
                  // Round the top of the stack only (4px), squared everywhere else.
                  const r = si === top ? Math.min(4, barW / 2, h) : 0;
                  const d = `M ${xLeft} ${yTopPx + h} V ${yTopPx + r} Q ${xLeft} ${yTopPx} ${xLeft + r} ${yTopPx} H ${xLeft + barW - r} Q ${xLeft + barW} ${yTopPx} ${xLeft + barW} ${yTopPx + r} V ${yTopPx + h} Z`;
                  return <path key={st.key} d={d} fill={color(si)} />;
                })}
              </g>
            );
          })}

          {line && (
            <path
              d={line.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${yScale(v)}`).join(' ')}
              fill="none"
              className="chart-overlay-line"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {x.map((v, i) => (
            <rect
              key={`hit-${v}`}
              x={cx(i) - band / 2}
              y={plotTop}
              width={band}
              height={plotBottom - plotTop}
              fill="transparent"
              tabIndex={0}
              aria-label={`${formatX(v)}: ${stacks.map((s) => `${s.label} ${formatY(s.values[i])}`).join(', ')}${line ? `, ${line.label} ${formatY(line.values[i])}` : ''}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>

        {hover !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(cx(hover) / WIDTH) * 100}%`,
              top: `${(plotTop / HEIGHT) * 100}%`,
              transform: cx(hover) / WIDTH > 0.6 ? 'translate(calc(-100% - 8px), 0)' : 'translate(8px, 0)',
            }}
          >
            <div className="chart-tooltip-header">{formatX(x[hover])}</div>
            {stacks.map((s, si) => (
              <div className="chart-tooltip-row" key={s.key}>
                <span className="chart-tooltip-key" style={{ background: color(si) }} />
                <span className="chart-tooltip-value">{formatY(s.values[hover])}</span>
                <span className="chart-tooltip-label">{s.label}</span>
              </div>
            ))}
            {line && (
              <div className="chart-tooltip-row">
                <span className="chart-tooltip-key chart-tooltip-key-line" />
                <span className="chart-tooltip-value">{formatY(line.values[hover])}</span>
                <span className="chart-tooltip-label">{line.label}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <ul className="chart-legend">
        {stacks.map((s, si) => (
          <li key={s.key}>
            <span className="chart-legend-swatch" style={{ background: color(si) }} />
            {s.label}
          </li>
        ))}
        {line && (
          <li>
            <span className="chart-legend-swatch chart-legend-line" />
            {line.label}
          </li>
        )}
      </ul>
    </div>
  );
}
