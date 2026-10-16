import { useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';

const WIDTH = 640;
const HEIGHT = 300;
const MARGIN = { top: 34, right: 20, bottom: 58, left: 56 };
const GAP = 2; // surface gap between bars

// Hand-rolled SVG histogram (Monte Carlo, phase 8): one bar per bin (monteCarlo.js histogram), a
// shaded band (the middle half of paths) and dashed markers (the median, a need) at their values,
// and a tooltip per bar. One hue: the bars show one distribution.
//   bins: [{ from, to, count, open }]; total: the number of paths (for the tooltip's share)
//   formatValue(v): a value on the axis; formatBin(bin): a bar's range in the tooltip
//   band: { from, to, label } (optional); marks: [{ x, label }] (optional)
export default function Histogram({ bins, total, formatValue, formatBin, band, marks = [], xLabel, yLabel = 'Paths', color = 'var(--series-1)' }) {
  const [hover, setHover] = useState(null);
  const plotLeft = MARGIN.left;
  const plotRight = WIDTH - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;
  if (bins.length === 0) return null;

  const yMax = Math.max(1, ...bins.map((b) => b.count));
  const yTicks = niceTicks(0, yMax, 4).filter((t) => Number.isInteger(t));
  const yScale = linearScale([0, Math.max(yMax, yTicks.at(-1))], [plotBottom, plotTop]);
  const bw = (plotRight - plotLeft) / bins.length;
  const left = (i) => plotLeft + i * bw;
  // A value's position: within its bin, in proportion (past the last bin: its right edge).
  const xOf = (v) => {
    const i = bins.findIndex((b, k) => v < b.to || k === bins.length - 1);
    const b = bins[i];
    const f = b.to > b.from ? Math.min(1, Math.max(0, (v - b.from) / (b.to - b.from))) : 0.5;
    return left(i) + f * bw;
  };
  const labelEvery = Math.max(1, Math.ceil(bins.length / 6));
  const barTop = (b) => yScale(b.count);
  // A bar with its top corners rounded (4px, less on a short bar), its base on the axis.
  const barPath = (i, b) => {
    const x0 = left(i) + GAP / 2;
    const x1 = left(i) + bw - GAP / 2;
    const y = barTop(b);
    const r = Math.min(4, (x1 - x0) / 2, plotBottom - y);
    return `M ${x0} ${plotBottom} L ${x0} ${y + r} Q ${x0} ${y} ${x0 + r} ${y} L ${x1 - r} ${y} Q ${x1} ${y} ${x1} ${y + r} L ${x1} ${plotBottom} Z`;
  };

  return (
    <div className="chart-wrap">
      <div className="chart" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
          {band && (
            <g>
              <rect x={xOf(band.from)} y={plotTop} width={Math.max(1, xOf(band.to) - xOf(band.from))} height={plotBottom - plotTop} className="chart-shade" />
              <text x={(xOf(band.from) + xOf(band.to)) / 2} y={plotTop - 8} textAnchor="middle" className="chart-zone-label">
                {band.label}
              </text>
            </g>
          )}
          {yTicks.map((t) => (
            <g key={`grid-${t}`}>
              <line x1={plotLeft} x2={plotRight} y1={yScale(t)} y2={yScale(t)} className="chart-gridline" />
              <text x={plotLeft - 8} y={yScale(t)} className="chart-tick chart-tick-y" textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {bins.map((b, i) =>
            b.count > 0 ? <path key={`bar-${i}`} d={barPath(i, b)} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} /> : null,
          )}
          {bins.map((b, i) =>
            i % labelEvery === 0 ? (
              <text key={`xt-${i}`} x={left(i)} y={plotBottom + 18} className="chart-tick chart-tick-x" textAnchor="middle">
                {formatValue(b.from)}
              </text>
            ) : null,
          )}
          {marks.map((m, i) => (
            <g key={`mark-${i}`}>
              <line x1={xOf(m.x)} x2={xOf(m.x)} y1={plotTop} y2={plotBottom} className="chart-ref-line" />
              <text
                x={xOf(m.x) + (xOf(m.x) > (plotLeft + plotRight) / 2 ? -4 : 4)}
                y={plotTop + 12 + i * 14}
                textAnchor={xOf(m.x) > (plotLeft + plotRight) / 2 ? 'end' : 'start'}
                className="chart-zone-label"
              >
                {m.label}
              </text>
            </g>
          ))}
          {xLabel && (
            <text x={(plotLeft + plotRight) / 2} y={HEIGHT - 10} className="chart-axis-title" textAnchor="middle">
              {xLabel}
            </text>
          )}
          <text transform={`translate(14, ${(plotTop + plotBottom) / 2}) rotate(-90)`} className="chart-axis-title" textAnchor="middle">
            {yLabel}
          </text>
          {bins.map((b, i) => (
            <rect
              key={`hit-${i}`}
              x={left(i)}
              y={plotTop}
              width={bw}
              height={plotBottom - plotTop}
              fill="transparent"
              tabIndex={0}
              aria-label={`${formatBin(b)}: ${b.count} paths`}
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
              left: `${((left(hover) + bw / 2) / WIDTH) * 100}%`,
              top: `${(plotTop / HEIGHT) * 100}%`,
              transform: (left(hover) + bw / 2) / WIDTH > 0.6 ? 'translate(calc(-100% - 8px), 0)' : 'translate(8px, 0)',
            }}
          >
            <div className="chart-tooltip-header">{formatBin(bins[hover])}</div>
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-key" style={{ background: color }} />
              <span className="chart-tooltip-value">{bins[hover].count}</span>
              <span className="chart-tooltip-label">
                paths ({Math.round((bins[hover].count / total) * 100)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
