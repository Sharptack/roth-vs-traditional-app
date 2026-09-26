import { useState } from 'react';
import { linearScale, niceTicks } from '../../lib/chartScale.js';
import { SERIES_COLORS } from './palette.js';

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 16, right: 20, bottom: 58, left: 72 };

function padDomain(min, max, fraction) {
  const span = max - min || Math.abs(max) || 1;
  return [min - span * fraction, max + span * fraction];
}

// Hand-rolled SVG line chart: one series per line, a shared numeric x-axis
// (values need not be evenly spaced — incomes, e.g., are plotted at their real
// dollar position), a crosshair + one tooltip listing every series at that x,
// and a legend when there's more than one series (see the dataviz skill).
// `zones` (optional): { above: { label, color }, below: { label, color } } shades the areas above and
// below the zero line and labels them (used to show who comes out ahead).
export default function LineChart({ series, xTicks, formatX, formatY, formatYTick = formatY, xLabel, yLabel, zones }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const plotLeft = MARGIN.left;
  const plotRight = WIDTH - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = HEIGHT - MARGIN.bottom;

  const [xMin, xMax] = padDomain(Math.min(...xTicks), Math.max(...xTicks), 0.06);
  const xScale = linearScale([xMin, xMax], [plotLeft, plotRight]);
  const xPixels = xTicks.map((x) => xScale(x));
  // Voronoi-style hover columns: each tick's hit target spans the midpoints to
  // its neighbors, so uneven spacing (e.g. income levels) still tiles cleanly.
  const hitBounds = xTicks.map((_, i) => ({
    left: i === 0 ? plotLeft : (xPixels[i - 1] + xPixels[i]) / 2,
    right: i === xTicks.length - 1 ? plotRight : (xPixels[i] + xPixels[i + 1]) / 2,
  }));

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const [yPadMin, yPadMax] = padDomain(Math.min(...allY, 0), Math.max(...allY, 0), 0.15);
  const yTicksList = niceTicks(yPadMin, yPadMax, 5);
  const yDomainMin = Math.min(yPadMin, yTicksList[0]);
  const yDomainMax = Math.max(yPadMax, yTicksList[yTicksList.length - 1]);
  const yScale = linearScale([yDomainMin, yDomainMax], [plotBottom, plotTop]);

  // Every data point gets a marker and a hover column, but with many points the x labels
  // would collide, so label only round values (or every point when there are few).
  const roundTicks =
    xTicks.length > 6
      ? niceTicks(Math.min(...xTicks), Math.max(...xTicks), 6).filter(
          (t) => t >= Math.min(...xTicks) && t <= Math.max(...xTicks),
        )
      : xTicks;
  // Always label the first point too, when there is room next to the first round label.
  const firstX = Math.min(...xTicks);
  const labelTicks =
    roundTicks.includes(firstX) || (roundTicks.length > 0 && Math.abs(xScale(roundTicks[0]) - xScale(firstX)) < 44)
      ? roundTicks
      : [firstX, ...roundTicks];

  const hoveredX = hoverIndex === null ? null : xPixels[hoverIndex];

  return (
    <div className="chart-wrap">
      <div className="chart" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
          {zones && yDomainMin < 0 && yDomainMax > 0 && (
            <g>
              <rect
                x={plotLeft}
                y={plotTop}
                width={plotRight - plotLeft}
                height={yScale(0) - plotTop}
                style={{ fill: `color-mix(in srgb, ${zones.above.color} 9%, transparent)` }}
              />
              <rect
                x={plotLeft}
                y={yScale(0)}
                width={plotRight - plotLeft}
                height={plotBottom - yScale(0)}
                style={{ fill: `color-mix(in srgb, ${zones.below.color} 9%, transparent)` }}
              />
              <text x={plotRight - 8} y={plotTop + 16} textAnchor="end" className="chart-zone-label">
                {zones.above.label}
              </text>
              <text x={plotRight - 8} y={plotBottom - 8} textAnchor="end" className="chart-zone-label">
                {zones.below.label}
              </text>
            </g>
          )}
          {yTicksList.map((t) => (
            <g key={`grid-${t}`}>
              <line x1={plotLeft} x2={plotRight} y1={yScale(t)} y2={yScale(t)} className="chart-gridline" />
              <text
                x={plotLeft - 8}
                y={yScale(t)}
                className="chart-tick chart-tick-y"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatYTick(t)}
              </text>
            </g>
          ))}
          {yDomainMin < 0 && yDomainMax > 0 && (
            <line x1={plotLeft} x2={plotRight} y1={yScale(0)} y2={yScale(0)} className="chart-zeroline" />
          )}

          {labelTicks.map((x) => (
            <text key={`xtick-${x}`} x={xScale(x)} y={plotBottom + 20} className="chart-tick chart-tick-x" textAnchor="middle">
              {formatX(x)}
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

          {hoveredX !== null && (
            <line x1={hoveredX} x2={hoveredX} y1={plotTop} y2={plotBottom} className="chart-crosshair" />
          )}

          {series.map((s, si) => {
            const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`).join(' ');
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                {s.points.map((p) => (
                  <circle
                    key={`${s.key}-${p.x}`}
                    cx={xScale(p.x)}
                    cy={yScale(p.y)}
                    r={4}
                    fill={color}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            );
          })}

          {xTicks.map((x, i) => (
            <rect
              key={`hit-${x}`}
              x={hitBounds[i].left}
              y={plotTop}
              width={Math.max(hitBounds[i].right - hitBounds[i].left, 1)}
              height={plotBottom - plotTop}
              fill="transparent"
              tabIndex={0}
              aria-label={`${formatX(x)}: ${series.map((s) => `${s.label} ${formatY(s.points[i]?.y)}`).join(', ')}`}
              onPointerEnter={() => setHoverIndex(i)}
              onFocus={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex(null)}
              onBlur={() => setHoverIndex(null)}
            />
          ))}
        </svg>

        {hoverIndex !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredX / WIDTH) * 100}%`,
              top: `${(plotTop / HEIGHT) * 100}%`,
              transform: hoveredX / WIDTH > 0.6 ? 'translate(calc(-100% - 8px), 0)' : 'translate(8px, 0)',
            }}
          >
            <div className="chart-tooltip-header">{formatX(xTicks[hoverIndex])}</div>
            {series.map((s, si) => (
              <div className="chart-tooltip-row" key={s.key}>
                <span
                  className="chart-tooltip-key"
                  style={{ background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length] }}
                />
                <span className="chart-tooltip-value">{formatY(s.points[hoverIndex]?.y)}</span>
                <span className="chart-tooltip-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((s, si) => (
            <li key={s.key}>
              <span
                className="chart-legend-swatch"
                style={{ background: s.color ?? SERIES_COLORS[si % SERIES_COLORS.length] }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
