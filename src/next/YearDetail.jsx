// One projection year opened up (roadmap phase 6 step a, decided 2026-10-12): what makes up each
// total in the year table: income by source, withdrawals and conversions by account (the RMD part
// marked), the tax calculator's rows for the year, spending, and each account from start to end.
// Renders row.detail through lib/projectionDetail.js; no math of its own beyond adding up lines.
import { formatCurrency as $ } from '../lib/format.js';
import { accountLabels, incomeLabel, yearTaxRowsOf } from '../lib/projectionDetail.js';
import { CalculationRows } from './TaxResult.jsx';

const Line = ({ label, value, kind = '' }) => (
  <div className={`calc-row ${kind}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const signed = (v) => (Math.abs(v) < 0.5 ? '—' : v < 0 ? `− ${$(-v)}` : $(v));

// An account's year as columns; a flow column shows only when some account has it this year.
const FLOW_COLUMNS = [
  { key: 'start', label: 'Start', value: (a) => a.start, always: true },
  { key: 'withdrawn', label: 'Withdrawn', value: (a) => -a.withdrawn },
  { key: 'converted', label: 'Converted', value: (a) => a.convertedIn - a.convertedOut },
  { key: 'contributed', label: 'Contributed', value: (a) => a.contributed },
  { key: 'employer', label: 'Employer', value: (a) => a.employer },
  { key: 'reinvested', label: 'Surplus saved', value: (a) => a.reinvested },
  { key: 'growth', label: 'Growth', value: (a) => a.growth - a.dividendTax, always: true },
  { key: 'end', label: 'End', value: (a) => a.end, always: true },
];

export default function YearDetail({ row, couple = false, pensionCount = 1 }) {
  const d = row.detail;
  const labels = accountLabels(d.accounts, { couple });
  const totalIncome = d.income.reduce((s, x) => s + x.amount, 0);
  const drawn = d.accounts.filter((a) => a.withdrawn > 0.005);
  const converted = d.accounts.filter((a) => a.convertedOut > 0.005);
  const anyRetired = row.working.some((w, i) => !w && row.alive[i] !== false);
  const s = d.spending;
  const flowCols = FLOW_COLUMNS.filter((c) => c.always || d.accounts.some((a) => Math.abs(c.value(a)) >= 0.5));
  return (
    <div className="year-detail">
      <div className="year-detail-grid">
        <section>
          <h4>Income</h4>
          <div className="calc">
            {d.income.map((x, i) => (
              <Line key={i} label={incomeLabel(x, { couple, pensionCount })} value={$(x.amount)} />
            ))}
            {d.income.length === 0 && <p className="hint">No income from earnings, Social Security, pensions or other rows this year.</p>}
            {d.income.length > 1 && <Line label="Total" value={$(totalIncome)} kind="total" />}
            {row.dividends > 0 && <Line label="Dividends from the taxable accounts (reinvested)" value={$(row.dividends)} kind="sub" />}
          </div>

          <h4>Withdrawals and conversions</h4>
          <div className="calc">
            {drawn.map((a) => (
              <div key={a.id}>
                <Line label={`From ${labels[a.id]}`} value={$(a.withdrawn)} />
                {a.rmd > 0.005 && <Line label="of which the required minimum (RMD)" value={$(Math.min(a.rmd, a.withdrawn))} kind="sub" />}
              </div>
            ))}
            {drawn.length > 1 && <Line label="Total withdrawn" value={$(row.withdrawals.total)} kind="total" />}
            {drawn.length === 0 && <p className="hint">{anyRetired ? 'Nothing withdrawn this year.' : 'Nothing withdrawn: the paycheck pays the spending while anyone works.'}</p>}
            {converted.map((a) => (
              <Line key={a.id} label={`Converted to Roth from ${labels[a.id]}`} value={$(a.convertedOut)} />
            ))}
            {row.conversionTaxWithheld > 0.005 && <Line label="its tax, held back from the conversion" value={$(row.conversionTaxWithheld)} kind="sub" />}
          </div>

          <h4>Spending</h4>
          <div className="calc">
            {anyRetired ? (
              <>
                <Line label="The spending need" value={$(s.baseNeed)} />
                {Math.abs(s.need - s.baseNeed) > 0.005 && <Line label="this year, at the survivor share" value={$(s.need)} kind="sub" />}
                <Line label="After-tax income (after tax, savings and IRMAA)" value={$(s.afterTaxIncome)} />
              </>
            ) : (
              <>
                <Line label="After-tax income (after tax and savings)" value={$(s.afterTaxIncome)} />
                <p className="hint">While anyone works the paycheck is the budget; only income beyond it counts as surplus.</p>
              </>
            )}
            {s.extraSpending > 0.005 && <Line label="Surplus spent (above the need)" value={$(s.extraSpending)} />}
            {s.reinvested > 0.005 && <Line label="Surplus saved (to a taxable account)" value={$(s.reinvested)} />}
            {s.shortfall > 0.005 && <Line label="Shortfall (the need not met)" value={$(s.shortfall)} kind="total" />}
          </div>
        </section>

        <section>
          <h4>Taxes</h4>
          <div className="calc">
            <CalculationRows rows={yearTaxRowsOf(row)} />
          </div>
        </section>
      </div>

      <h4>Accounts</h4>
      <div className="table-scroll">
        <table className="compare-table projection-table year-accounts">
          <thead>
            <tr>
              <th scope="col">Account</th>
              {flowCols.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.accounts.map((a) => (
              <tr key={a.id}>
                <th scope="row">{labels[a.id]}</th>
                {flowCols.map((c) => (
                  <td key={c.key} title={c.key === 'growth' && a.dividendTax > 0.005 ? `after ${$(a.dividendTax)} of tax on its dividends` : undefined}>
                    {c.always ? $(c.value(a)) : signed(c.value(a))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Growth is the year&rsquo;s return on what stays invested (dividends included, less any tax the account paid on
        them). Contributions, the employer&rsquo;s money and saved surplus go in at the end of the year.
      </p>
    </div>
  );
}
