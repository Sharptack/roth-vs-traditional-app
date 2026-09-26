// The break-even map: a grid of scenarios (rows = savings rates, columns = incomes), each cell
// tinted by who comes out ahead and by how much. Roth = blue, Pre-tax = orange (a diverging
// pair with a neutral middle, so "about even" reads as no colour at all). Every cell also
// prints its number, so colour is never the only channel.

// Roth advantage (%) at which a cell reaches full tint.
const FULL_TINT_AT = 20;

function cellStyle(cell) {
  if (cell.winner === 'even') return undefined;
  const strength = Math.min(Math.abs(cell.advantagePct) / FULL_TINT_AT, 1);
  const color = cell.advantagePct > 0 ? 'var(--series-1)' : 'var(--series-2)';
  return { background: `color-mix(in srgb, ${color} ${Math.round(8 + strength * 57)}%, transparent)` };
}

function who(cell) {
  if (cell.winner === 'even') return 'about even';
  return cell.advantagePct > 0 ? 'Roth ahead' : 'Pre-tax ahead';
}

export default function Heatmap({ rows, formatIncome, formatCell, formatDetail }) {
  const incomes = rows[0].cells.map((c) => c.income);

  return (
    <div className="chart-wrap">
      <div className="table-wrap">
        <table className="heatmap">
          <caption className="sr-only">
            Roth advantage by gross income (across) and share of income saved (down)
          </caption>
          <thead>
            <tr>
              <th scope="col" className="heatmap-corner">
                Saved &darr; &nbsp; Income &rarr;
              </th>
              {incomes.map((income) => (
                <th scope="col" key={income}>
                  {formatIncome(income)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rate}>
                <th scope="row">{Math.round(row.rate * 100)}%</th>
                {row.cells.map((cell) => (
                  <td
                    key={cell.income}
                    style={cellStyle(cell)}
                    title={`${formatIncome(cell.income)} income, ${Math.round(row.rate * 100)}% saved: ${who(cell)} (${formatDetail(cell)})`}
                  >
                    {formatCell(cell)}
                    {cell.overLimit && <span className="heatmap-flag">*</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="heatmap-legend">
        <span>Pre-tax ahead</span>
        <span className="heatmap-scale" aria-hidden="true" />
        <span>Roth ahead</span>
        <span className="heatmap-legend-note">
          Full colour at {FULL_TINT_AT}% or more. Blank = about even. * = savings above the IRS limit; the
          excess goes to a taxable account.
        </span>
      </div>
    </div>
  );
}
