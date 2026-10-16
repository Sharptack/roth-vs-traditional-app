// A winner map for three (or more) scenarios: rows x columns of grid points, each cell tinted by the
// scenario that comes out ahead (categorical colors, fixed by scenario), and printing its name and
// lead, so color is never the only channel. Cells not yet run stay blank.
//   rows / columns: [{ key, label }]; cellAt(rowKey, columnKey) -> a result or undefined
//   scenarios: { [key]: { label, short, color } }; 'even' cells are untinted.
//   describe(result) -> the cell's hover text; formatLead(result) -> the lead under the name.
//   legend (default true): the key under the map (off for all but one of a set of maps).
//   marks: [{ symbol, note, test(result) }]: a symbol after the name in the cells it applies to, and its
//   note in the legend.

export default function WinnerGrid({
  caption,
  rows,
  columns,
  rowHeading,
  columnHeading,
  cellAt,
  scenarios,
  describe,
  formatLead,
  marks = [],
  legend = true,
}) {
  return (
    <div className="table-wrap">
      <table className="heatmap winner-grid">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="heatmap-corner">
              {rowHeading} &darr; &nbsp; {columnHeading} &rarr;
            </th>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {columns.map((col) => {
                const r = cellAt(row.key, col.key);
                if (!r) return <td key={col.key} className="winner-grid-pending" aria-label="not run yet" />;
                const s = scenarios[r.winner];
                return (
                  <td
                    key={col.key}
                    style={
                      s
                        ? {
                            background: `color-mix(in srgb, ${s.color} 42%, transparent)`,
                          }
                        : undefined
                    }
                    title={describe(r)}
                  >
                    <span className="winner-grid-name">
                      {s ? s.short : 'Even'}
                      {marks
                        .filter((m) => m.test(r))
                        .map((m) => (
                          <span key={m.symbol} className="heatmap-flag">
                            {m.symbol}
                          </span>
                        ))}
                    </span>
                    <span className="winner-grid-lead">{formatLead(r)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legend && (
        <ul className="chart-legend winner-grid-legend">
          {Object.entries(scenarios).map(([key, s]) => (
            <li key={key}>
              <span
                className="winner-grid-swatch"
                style={{
                  background: `color-mix(in srgb, ${s.color} 42%, transparent)`,
                }}
              />
              {s.short} = {s.label}
            </li>
          ))}
          <li>
            <span className="winner-grid-swatch" />
            Even = within 0.5% of each other
          </li>
          {marks.map((m) => (
            <li key={m.symbol}>
              {m.symbol} = {m.note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
