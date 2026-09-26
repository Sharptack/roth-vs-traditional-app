import { useId, useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';

const WIDTH = 640;
const HEIGHT = 400;
const MARGIN = { top: 16, right: 20, bottom: 58, left: 72 };

function padDomain(min, max, fraction) {
  const span = max - min || Math.abs(max) || 1;
  return [min - span * fraction, max + span * fraction];
}

// Hand-rolled SVG scatter: one point per scenario, coloured by who comes out ahead
// (`groups` gives each group's key, label and colour; each point carries its `group`),
// with a fitted trend line to show how closely the rate gap predicts the advantage.
export default function ScatterChart({
  points,
  groups,
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

  const colorOf = Object.fromEntries(groups.map((g) => [g.key, g.color]));

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

          {points.map((p, i) => (
            <circle
              key={`pt-${i}`}
              cx={xScale(p.x)}
              cy={yScale(p.y)}
              r={5}
              fill={colorOf[p.group]}
              stroke="var(--card)"
              strokeWidth={1.5}
              opacity={hoverIdx === null || hoverIdx === i ? 0.85 : 0.3}
            />
          ))}

          {points.map((p, i) => (
            <circle
              key={`hit-${i}`}
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
        {groups.map((g) => (
          <li key={g.key}>
            <span className="chart-legend-dot" style={{ background: g.color }} />
            {g.label}
          </li>
        ))}
        <li>
          <span className="chart-legend-trend" />
          Trend line
        </li>
      </ul>
    </div>
  );
}
