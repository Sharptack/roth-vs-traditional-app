import { useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';
import { SERIES_COLORS } from './palette.js';

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 16, right: 20, bottom: 58, left: 72 };
const GAP = 1; // between the bars of one group

// Hand-rolled SVG grouped bar chart (the Roth page's tax each year): one group per x, the series'
// bars side by side in the given order, a hover column with one tooltip per x, and a legend.
// Values are never negative here (a negative one draws as nothing).
//   x: [values]; series: [{ key, label, color?, values }]
export default function GroupedBarChart({ x, series, formatX, formatY, formatYTick = formatY, xLabel, yLabel }) {
  const [hover, setHover] = useState(null);
  const plotLeft = MARGIN.left;
  const plotRight = WIDTH - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;

  const yMax = Math.max(1, ...series.flatMap((s) => s.values));
  const yTicks = niceTicks(0, yMax * 1.05, 5);
  const yTop = Math.max(yMax, yTicks[yTicks.length - 1]);
  const yScale = linearScale([0, yTop], [plotBottom, plotTop]);
  const band = (plotRight - plotLeft) / Math.max(1, x.length);
  const groupW = Math.max(2 * series.length, Math.min(40, band * 0.8));
  const barW = Math.max(1, (groupW - GAP * (series.length - 1)) / series.length);
  const cx = (i) => plotLeft + band * (i + 0.5);
  const labelEvery = Math.max(1, Math.ceil(x.length / 12));
  const color = (si) => series[si].color ?? SERIES_COLORS[si % SERIES_COLORS.length];

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

          {x.map((v, i) => (
            <g key={`group-${v}`}>
              {series.map((s, si) => {
                const value = Math.max(0, s.values[i]);
                if (!(value > 0)) return null;
                const h = plotBottom - yScale(value);
                const xLeft = cx(i) - groupW / 2 + si * (barW + GAP);
                const r = Math.min(3, barW / 2, h);
                const yTopPx = plotBottom - h;
                const d = `M ${xLeft} ${plotBottom} V ${yTopPx + r} Q ${xLeft} ${yTopPx} ${xLeft + r} ${yTopPx} H ${xLeft + barW - r} Q ${xLeft + barW} ${yTopPx} ${xLeft + barW} ${yTopPx + r} V ${plotBottom} Z`;
                return <path key={s.key} d={d} fill={color(si)} />;
              })}
            </g>
          ))}

          {x.map((v, i) => (
            <rect
              key={`hit-${v}`}
              x={cx(i) - band / 2}
              y={plotTop}
              width={band}
              height={plotBottom - plotTop}
              fill="transparent"
              tabIndex={0}
              aria-label={`${formatX(v)}: ${series.map((s) => `${s.label} ${formatY(s.values[i])}`).join(', ')}`}
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
            {series.map((s, si) => (
              <div className="chart-tooltip-row" key={s.key}>
                <span className="chart-tooltip-key" style={{ background: color(si) }} />
                <span className="chart-tooltip-value">{formatY(s.values[hover])}</span>
                <span className="chart-tooltip-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ul className="chart-legend">
        {series.map((s, si) => (
          <li key={s.key}>
            <span className="chart-legend-swatch" style={{ background: color(si) }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
