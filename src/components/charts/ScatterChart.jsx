import { useId, useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';
import { SERIES_COLORS, SERIES_SHAPES } from './palette.js';

const WIDTH = 640;
const HEIGHT = 400;
const MARGIN = { top: 16, right: 20, bottom: 58, left: 72 };

function padDomain(min, max, fraction) {
  const span = max - min || Math.abs(max) || 1;
  return [min - span * fraction, max + span * fraction];
}

// A shape drawn at the origin, sized by `r`; scatter points carry both a
// (batch) color AND a shape, since a 5-way categorical palette isn't
// guaranteed colorblind-safe for every pair once every point can sit next to
// every other point (see the dataviz skill's "all-pairs" note).
function ShapePath({ shape, r }) {
  switch (shape) {
    case 'square':
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} />;
    case 'triangle':
      return <polygon points={`0,${-r * 1.15} ${r * 1.05},${r * 0.75} ${-r * 1.05},${r * 0.75}`} />;
    case 'triangleDown':
      return <polygon points={`0,${r * 1.15} ${r * 1.05},${-r * 0.75} ${-r * 1.05},${-r * 0.75}`} />;
    case 'diamond':
      return <polygon points={`0,${-r * 1.25} ${r * 1.25},0 0,${r * 1.25} ${-r * 1.25},0`} />;
    case 'cross':
      return (
        <>
          <rect x={-r * 1.15} y={-r * 0.35} width={r * 2.3} height={r * 0.7} />
          <rect x={-r * 0.35} y={-r * 1.15} width={r * 0.7} height={r * 2.3} />
        </>
      );
    default:
      return <circle r={r} />;
  }
}

export function LegendIcon({ shape, color }) {
  return (
    <svg viewBox="-8 -8 16 16" width={14} height={14} aria-hidden="true">
      <g fill={color}>
        <ShapePath shape={shape} r={6} />
      </g>
    </svg>
  );
}

// Hand-rolled SVG scatter: one point per scenario, colored + shaped by which
// batch it came from, with a fitted trend line to visualize whether the rate
// gap actually predicts the Roth/Pre-tax advantage.
export default function ScatterChart({
  points,
  batches,
  regression,
  formatX,
  formatY,
  formatXTick = formatX,
  formatYTick = formatY,
  xLabel,
  yLabel,
}) {
  const clipId = useId();
  const [hoverIdx, setHoverIdx] = useState(null);

  const plotLeft = MARGIN.left;
  const plotRight = WIDTH - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [xPadMin, xPadMax] = padDomain(Math.min(...xs, 0), Math.max(...xs, 0), 0.12);
  const [yPadMin, yPadMax] = padDomain(Math.min(...ys, 0), Math.max(...ys, 0), 0.12);
  const xTicksList = niceTicks(xPadMin, xPadMax, 6);
  const yTicksList = niceTicks(yPadMin, yPadMax, 6);
  const xDomainMin = Math.min(xPadMin, xTicksList[0]);
  const xDomainMax = Math.max(xPadMax, xTicksList[xTicksList.length - 1]);
  const yDomainMin = Math.min(yPadMin, yTicksList[0]);
  const yDomainMax = Math.max(yPadMax, yTicksList[yTicksList.length - 1]);
  const xScale = linearScale([xDomainMin, xDomainMax], [plotLeft, plotRight]);
  const yScale = linearScale([yDomainMin, yDomainMax], [plotBottom, plotTop]);

  const batchIndex = Object.fromEntries(batches.map((b, i) => [b.key, i]));

  return (
    <div className="chart-wrap">
      <div className="chart" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id={clipId}>
              <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} />
            </clipPath>
          </defs>

          {yTicksList.map((t) => (
            <g key={`ygrid-${t}`}>
              <line x1={plotLeft} x2={plotRight} y1={yScale(t)} y2={yScale(t)} className="chart-gridline" />
              <text x={plotLeft - 8} y={yScale(t)} className="chart-tick chart-tick-y" textAnchor="end" dominantBaseline="middle">
                {formatYTick(t)}
              </text>
            </g>
          ))}
          {xTicksList.map((t) => (
            <text key={`xtick-${t}`} x={xScale(t)} y={plotBottom + 20} className="chart-tick chart-tick-x" textAnchor="middle">
              {formatXTick(t)}
            </text>
          ))}
          {xLabel && (
            <text x={(plotLeft + plotRight) / 2} y={HEIGHT - 10} className="chart-axis-title" textAnchor="middle">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text
              transform={`translate(16, ${(plotTop + plotBottom) / 2}) rotate(-90)`}
              className="chart-axis-title"
              textAnchor="middle"
            >
              {yLabel}
            </text>
          )}
          {yDomainMin < 0 && yDomainMax > 0 && (
            <line x1={plotLeft} x2={plotRight} y1={yScale(0)} y2={yScale(0)} className="chart-zeroline" />
          )}
          {xDomainMin < 0 && xDomainMax > 0 && (
            <line x1={xScale(0)} x2={xScale(0)} y1={plotTop} y2={plotBottom} className="chart-zeroline" />
          )}

          {regression && (
            <g clipPath={`url(#${clipId})`}>
              <line
                x1={xScale(xDomainMin)}
                y1={yScale(regression.slope * xDomainMin + regression.intercept)}
                x2={xScale(xDomainMax)}
                y2={yScale(regression.slope * xDomainMax + regression.intercept)}
                className="chart-trendline"
              />
            </g>
          )}

          {points.map((p, i) => {
            const bi = batchIndex[p.batchKey] ?? 0;
            const color = SERIES_COLORS[bi % SERIES_COLORS.length];
            const shape = SERIES_SHAPES[bi % SERIES_SHAPES.length];
            return (
              <g
                key={`${p.batchKey}-${p.seriesLabel}-${i}`}
                transform={`translate(${xScale(p.x)}, ${yScale(p.y)})`}
                fill={color}
                opacity={hoverIdx === null || hoverIdx === i ? 0.9 : 0.35}
              >
                <ShapePath shape={shape} r={5} />
              </g>
            );
          })}

          {points.map((p, i) => (
            <circle
              key={`hit-${p.batchKey}-${p.seriesLabel}-${i}`}
              cx={xScale(p.x)}
              cy={yScale(p.y)}
              r={12}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.batchTitle}, ${p.seriesLabel}: gap ${formatX(p.x)}, ${formatY(p.y)}`}
              onPointerEnter={() => setHoverIdx(i)}
              onFocus={() => setHoverIdx(i)}
              onPointerLeave={() => setHoverIdx(null)}
              onBlur={() => setHoverIdx(null)}
            />
          ))}
        </svg>

        {hoverIdx !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(xScale(points[hoverIdx].x) / WIDTH) * 100}%`,
              top: `${(yScale(points[hoverIdx].y) / HEIGHT) * 100}%`,
              transform:
                xScale(points[hoverIdx].x) / WIDTH > 0.6
                  ? 'translate(calc(-100% - 12px), -50%)'
                  : 'translate(12px, -50%)',
            }}
          >
            <div className="chart-tooltip-header">{points[hoverIdx].batchTitle}</div>
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-label">{points[hoverIdx].seriesLabel}</span>
            </div>
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-value">{formatX(points[hoverIdx].x)}</span>
              <span className="chart-tooltip-label">rate gap</span>
            </div>
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-value">{formatY(points[hoverIdx].y)}</span>
              <span className="chart-tooltip-label">Roth advantage</span>
            </div>
          </div>
        )}
      </div>

      <ul className="chart-legend">
        {batches.map((b, i) => (
          <li key={b.key}>
            <LegendIcon shape={SERIES_SHAPES[i % SERIES_SHAPES.length]} color={SERIES_COLORS[i % SERIES_COLORS.length]} />
            {b.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
