// The version 2 household's inputs (round 2 phase 0, step b; regrouped 2026-10-08): the inputs page
// (four groups, each section its own card across the page) and each calculator's inputs card (only
// the sections and fields it reads, as rows of one card). Sections, groups, summaries and each
// calculator's list come from lib/householdInputs.js; every change goes through
// lib/householdValues.js's update functions.
import { useId, useState } from 'react';
import Collapsible, { toggleId } from '../components/Collapsible.jsx';
import {
  AgeInput,
  BASIS_OPTIONS,
  CurrencyInput,
  LIFESTYLE_OPTIONS,
  RETURN_OPTIONS,
  RadioGroup,
  SelectInput,
  toOptions,
} from '../components/fields.jsx';
import { FILING_STATUSES } from '../lib/constants.js';
import {
  ACCOUNT_TYPE_LABELS,
  ALL_SECTION_IDS,
  ASSUMPTION_FIELDS,
  CONTRIBUTION_ACCOUNT_LABELS,
  CONTRIBUTION_TAX_LABELS,
  INCOME_TYPE_LABELS,
  LIABILITY_KIND_LABELS,
  MONTHLY_INCOME_TYPES,
  OTHER_KIND_LABELS,
  OWNER_LABELS,
  PERSON_FIELDS,
  incomeRowSummary,
  accountRowSummary,
  inputSections,
  sectionChanged,
} from '../lib/householdInputs.js';
import {
  NEW_PENSION,
  activePeople,
  everyoneRetiredV2,
  addRow,
  hasSpouseV2,
  isoDate,
  newRowId,
  removeRow,
  setGroupField,
  setIncludeSpouse,
  setPersonField,
  updateRow,
} from '../lib/householdValues.js';
import { STRATEGIES } from '../lib/strategies.js';

const labelOptions = (labels, keys = Object.keys(labels)) => keys.map((value) => ({ value, label: labels[value] }));

const COLA_OPTIONS = ['0', '0.01', '0.02', '0.025', '0.03'].map((v) => ({ value: v, label: v === '0' ? 'None' : `${Number(v) * 100}%` }));
const SURVIVOR_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
];

const CLAIM_AGE_OPTIONS = [
  { value: '', label: 'At retirement' },
  ...[62, 63, 64, 65, 66, 67, 68, 69, 70].map((age) => ({ value: String(age), label: String(age) })),
];

const INFLATION_OPTIONS = [
  { value: '0', label: '0% (today’s thresholds, as the current calculator)' },
  { value: '0.02', label: '2%' },
  { value: '0.025', label: '2.5% (default)' },
  { value: '0.03', label: '3%' },
  { value: '0.04', label: '4%' },
];

const SEX_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const SS_MODE_OPTIONS = [
  { value: 'estimate', label: 'From earnings' },
  { value: 'pia', label: 'Enter the PIA' },
  { value: 'receiving', label: 'Currently receiving' },
];

// A labelled text input for what InputForm.jsx has no field for (a date, a percent).
function TextField({ label, hint, value, onChange, type = 'text', inputMode, placeholder, clean = (t) => t }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(clean(e.target.value))}
      />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

const percent = (t) => t.replace(/[^0-9.]/g, '').slice(0, 6);

// values: version 2 values; onUpdate(fn): apply fn(values) -> new values (the update functions of
//   householdValues.js), so quick changes never act on stale values.
// sections: the section ids to show, in order; fields: { people, assumptions } field lists (all
//   when not given); titles: section titles of the calculator's own. layout 'page': each section its
//   own card, in groups (the inputs page; groups: [{ id, title, sections }]); 'card': one card,
//   sections as rows (a calculator's inputs card).
// title, headLink: the card's heading and a link beside it ('card' layout); footer: content at the
//   bottom (the share link); title null: no heading (the page has its own). locked: view only (a view-only link); onEditCopy unlocks.
// defaultOpen: the sections open at first. baseValues: another household to compare with (the Roth
//   page's "Compare a change"): each section that differs from it is marked "changed".
export default function HouseholdInputs({
  values,
  onUpdate,
  sections: sectionIds = ALL_SECTION_IDS,
  fields = {},
  titles = {},
  groups,
  layout = 'card',
  title = 'Inputs',
  headLink,
  footer,
  locked = false,
  onEditCopy,
  defaultOpen = [],
  baseValues,
}) {
  const formId = useId();
  const [open, setOpen] = useState(() => new Set(defaultOpen));
  // Income rows open (closed: one line, type and amount; decided 2026-10-09): a new row opens.
  const [openRows, setOpenRows] = useState(() => new Set());
  // Income rows whose start/end ages were toggled: shown at first when one is filled in, else
  // hidden; the link opens and closes them (decided 2026-10-09).
  const [agesToggled, setAgesToggled] = useState(() => new Set());
  const sections = inputSections(sectionIds);
  const spouse = hasSpouseV2(values);
  const people = activePeople(values);
  const personFields = new Set(fields.people ?? PERSON_FIELDS);
  const assumptionFields = new Set(fields.assumptions ?? ASSUMPTION_FIELDS);
  const today = isoDate(new Date());

  const setGroup = (group, field) => (value) => onUpdate((v) => setGroupField(v, group, field, value));
  const setPerson = (id, field) => (value) => onUpdate((v) => setPersonField(v, id, field, value, today));
  const setRow = (list, id, field) => (value) => onUpdate((v) => updateRow(v, list, id, field, value));
  const add = (list, overrides) => onUpdate((v) => addRow(v, list, overrides));
  // An income row's type: a yearly amount and a monthly one (Social Security, a pension) don't
  // carry over, so switching between them clears the amount and ages.
  const setIncomeType = (row) => (type) =>
    onUpdate((v) => {
      let next = updateRow(v, 'incomes', row.id, 'type', type);
      if (MONTHLY_INCOME_TYPES.includes(type) !== MONTHLY_INCOME_TYPES.includes(row.type) || MONTHLY_INCOME_TYPES.includes(type)) {
        for (const field of ['amount', 'fromAge', 'toAge']) next = updateRow(next, 'incomes', row.id, field, '');
      }
      if (type === 'pension') for (const [field, value] of Object.entries(NEW_PENSION)) next = updateRow(next, 'incomes', row.id, field, value);
      return next;
    });
  const remove = (list, id) => onUpdate((v) => removeRow(v, list, id));

  const strategySelect = () => (
    <SelectInput
      label="Withdrawal strategy in retirement"
      hint="Which accounts pay for spending each year, in the projection and the Roth page's lifetime comparison. RMDs are always taken first. Conversions move Pre-tax money to Roth before RMDs start, taxed that year."
      value={values.calculators.projection.strategy}
      onChange={setGroup('calculators.projection', 'strategy')}
      options={STRATEGIES.map((st) => ({ value: st.id, label: st.label }))}
    />
  );
  const heirSelect = () => (
    <SelectInput
      label="Tax rate for heirs on inherited Pre-tax money"
      hint="Used only for the after-tax ending balance."
      value={values.calculators.projection.heirTaxRate}
      onChange={setGroup('calculators.projection', 'heirTaxRate')}
      options={['0', '0.12', '0.22', '0.24', '0.32', '0.35'].map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))}
    />
  );

  // A pension's lump-sum offer and which one the plan takes (decided 2026-10-09: on the pension row).
  const pensionChoice = (row) => (
    <>
      <div className="field-row">
        <CurrencyInput
          label="Lump sum offered"
          value={row.lumpSum ?? ''}
          onChange={setRow('incomes', row.id, 'lumpSum')}
        />
        <SelectInput
          label="In the plan"
          value={row.election ?? 'monthly'}
          onChange={setRow('incomes', row.id, 'election')}
          options={[
            { value: 'monthly', label: 'The monthly benefit' },
            { value: 'lumpSum', label: 'The lump sum' },
          ]}
        />
      </div>
      {/* the hint under the row, not under one field, so the two line up (decided 2026-10-09) */}
      <p className="hint">
        {row.election === 'lumpSum'
          ? 'Every calculator leaves the monthly benefit out; the lump sum is rolled over to a Pre-tax IRA at the start age (today, if that has passed).'
          : 'Leave the lump sum blank when none is offered.'}
      </p>
    </>
  );

  const ownerSelect = (list, row) =>
    spouse && (
      <SelectInput label="Whose" value={row.owner} onChange={setRow(list, row.id, 'owner')} options={labelOptions(OWNER_LABELS)} />
    );
  const removeButton = (list, row, i, what) => (
    <button type="button" className="link-button" aria-label={`Remove ${what} ${i + 1}`} onClick={() => remove(list, row.id)}>
      Remove
    </button>
  );

  const body = {
    household: () => (
      <>
        <div className="filing-status">
          <SelectInput
            label="Filing status"
            value={values.filingStatus}
            onChange={(value) => onUpdate((v) => ({ ...v, filingStatus: value }))}
            options={toOptions(FILING_STATUSES)}
          />
        </div>
        {values.filingStatus === 'mfj' && (
            <RadioGroup
              legend="Enter your spouse separately?"
              name={`${formId}-includeSpouse`}
              value={values.includeSpouse}
              onChange={(value) => onUpdate((v) => setIncludeSpouse(v, value === 'yes'))}
              options={[
                { value: 'no', label: 'No, one combined income' },
                { value: 'yes', label: 'Yes' },
              ]}
            />
        )}
        {values.filingStatus === 'mfj' && (
          <p className="hint">
            {spouse
              ? 'Payroll tax, Social Security and the IRS contribution limit are figured per person, with a spousal benefit when it is larger. The Roth comparison looks at the year the last of you retires; each of you saves until your own retirement.'
              : 'With one combined income, payroll tax and Social Security treat the household as one earner.'}
          </p>
        )}
        <div className={spouse ? 'people-grid' : 'people-grid one'}>
          {people.map((p) => (
            <fieldset key={p.id} className="person-column">
              <legend>{OWNER_LABELS[p.id]}</legend>
              {personFields.has('age') && (
                <div className="field-row">
                  <AgeInput label="Age" value={p.age} onChange={setPerson(p.id, 'age')} />
                  <TextField label="or birthdate" type="date" value={p.birthDate} onChange={setPerson(p.id, 'birthDate')} />
                </div>
              )}
              {(personFields.has('retirementAge') || personFields.has('planToAge')) && (
                <div className="field-row">
                  {personFields.has('retirementAge') && (
                    <AgeInput label="Retirement age" value={p.retirementAge} onChange={setPerson(p.id, 'retirementAge')} />
                  )}
                  {personFields.has('planToAge') && (
                    <AgeInput label="Life expectancy" value={p.planToAge} onChange={setPerson(p.id, 'planToAge')} />
                  )}
                </div>
              )}
              {personFields.has('sex') && (
                <SelectInput
                  label="Biological sex"
                  hint="Used only for the pension calculator's survival odds (SSA's period life table). The plan itself runs to each person's life expectancy above."
                  value={p.sex}
                  onChange={setPerson(p.id, 'sex')}
                  options={SEX_OPTIONS}
                />
              )}
            </fieldset>
          ))}
        </div>
        {/* what the two ages mean (decided 2026-10-09: "Plan to age" renamed "Life expectancy") */}
        {(personFields.has('retirementAge') || personFields.has('planToAge')) && (
          <p className="hint">
            {personFields.has('retirementAge') && 'Retirement age: when earnings and contributions stop and withdrawals begin; at or below the age now means already retired. '}
            {personFields.has('planToAge') && `Life expectancy: how long the plan has to last; it runs until ${spouse ? 'the last of you reaches theirs' : 'you reach it'}.`}
          </p>
        )}
      </>
    ),

    income: () => {
      const rows = values.incomes.filter((r) => people.some((p) => p.id === r.owner));
      const agesOpen = (r) => Boolean(String(r.fromAge).trim() || String(r.toAge).trim()) !== agesToggled.has(r.id);
      const fieldsFor = (r) => {
        if (r.type === 'socialSecurity') {
          return (
            <>
              <SelectInput
                label="Benefit"
                value={r.ssMode}
                onChange={setRow('incomes', r.id, 'ssMode')}
                options={SS_MODE_OPTIONS}
              />
              {r.ssMode === 'pia' && (
                <CurrencyInput
                  label="PIA (monthly)"
                  value={r.amount}
                  onChange={setRow('incomes', r.id, 'amount')}
                />
              )}
              {r.ssMode === 'receiving' && (
                <CurrencyInput
                  label="Monthly benefit now"
                  value={r.amount}
                  onChange={setRow('incomes', r.id, 'amount')}
                />
              )}
              {r.ssMode !== 'receiving' && (
                <SelectInput
                  label="Claim at"
                  value={r.fromAge}
                  onChange={setRow('incomes', r.id, 'fromAge')}
                  options={CLAIM_AGE_OPTIONS}
                />
              )}
              <p className="hint">
                {r.ssMode === 'receiving' ? (
                  "The monthly check as received today, before any Medicare premium is taken out, in today's dollars; it counts as is from this year on. Its PIA isn't known, so it adds no spousal benefit for a spouse."
                ) : (
                  <>
                    {r.ssMode === 'pia' ? "PIA: the monthly benefit at full retirement age, from the SSA statement, in today's dollars; the benefit at the claiming age, and any spousal benefit, are worked out from it." : "Estimated from this year's earnings; the PIA on the SSA statement is more precise."}{' '}
                    Claimed at retirement means at the retirement age, held within 62 to 70.
                  </>
                )}
              </p>
            </>
          );
        }
        if (r.type === 'pension') {
          return (
            <>
              <div className="field-row">
                <CurrencyInput label="Monthly benefit" hint="As the plan states it, at the start." value={r.amount} onChange={setRow('incomes', r.id, 'amount')} />
                <AgeInput label="Starts at age" value={r.fromAge} onChange={setRow('incomes', r.id, 'fromAge')} />
              </div>
              <div className="field-row">
                <SelectInput label="Cost-of-living increase" value={r.cola} onChange={setRow('incomes', r.id, 'cola')} options={COLA_OPTIONS} />
                {spouse && (
                  <SelectInput
                    label="Survivor benefit"
                    hint="The share the other spouse keeps (used from the survivor-years phase on)."
                    value={r.survivorShare}
                    onChange={setRow('incomes', r.id, 'survivorShare')}
                    options={SURVIVOR_OPTIONS}
                  />
                )}
              </div>
              {pensionChoice(r)}
            </>
          );
        }
        return (
          <>
            {r.type === 'other' && (
              <SelectInput label="Kind" value={r.treatment} onChange={setRow('incomes', r.id, 'treatment')} options={labelOptions(OTHER_KIND_LABELS)} />
            )}
            <CurrencyInput label="Amount (annual)" value={r.amount} onChange={setRow('incomes', r.id, 'amount')} />
            {r.type === '1099' && (
              <SelectInput
                label="Qualifies for the QBI deduction?"
                hint="Most self-employment income does (a trade or business in the US). Not: wages paid as a 1099 by a former employer, or income that is really investment income."
                value={r.qbi ?? 'yes'}
                onChange={setRow('incomes', r.id, 'qbi')}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
              />
            )}
            {agesOpen(r) && (
              <div className="field-row">
                <AgeInput label="Starts at age" value={r.fromAge} onChange={setRow('incomes', r.id, 'fromAge')} />
                <AgeInput label="Ends after age" value={r.toAge} onChange={setRow('incomes', r.id, 'toAge')} />
              </div>
            )}
            <button
              type="button"
              className="link-button row-ages-link"
              aria-expanded={agesOpen(r)}
              onClick={() => setAgesToggled((o) => toggleId(o, r.id))}
            >
              {agesOpen(r) ? 'Hide start/end ages' : 'Set start/end ages'}
            </button>
          </>
        );
      };
      return (
        <>
          <p className="hint">
            One row per source; click a row to open it. Earnings and other income are yearly, from now
            until retirement unless start and end ages are set (both included; a row starting at or after
            retirement runs for life). Social Security (one row each; without one, estimated from earnings)
            and pensions are monthly.
          </p>
          <ul className="account-list">
            {rows.map((r, i) => {
              const isOpen = openRows.has(r.id);
              const bodyId = `${formId}-income-${r.id}`;
              return (
                <li key={r.id} className={isOpen ? 'account-row income-row open' : 'account-row income-row'}>
                  <button
                    type="button"
                    className="income-row-head"
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => setOpenRows((o) => toggleId(o, r.id))}
                  >
                    <span className="collapsible-chevron" aria-hidden="true" />
                    <span>{incomeRowSummary(r, spouse)}</span>
                  </button>
                  <div id={bodyId} className="income-row-body" hidden={!isOpen}>
                    <div className="field-row">
                      <SelectInput label="Type" value={r.type} onChange={setIncomeType(r)} options={labelOptions(INCOME_TYPE_LABELS)} />
                      {ownerSelect('incomes', r)}
                    </div>
                    {fieldsFor(r)}
                    {removeButton('incomes', r, i, 'income')}
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setOpenRows((o) => new Set(o).add(newRowId(values.incomes, 'i')));
              add('incomes');
            }}
          >
            + Add income
          </button>
        </>
      );
    },

    contributions: () => {
      const rows = values.contributions.filter((r) => people.some((p) => p.id === r.owner));
      return (
        <>
          <p className="hint">
            What is saved each year, or being considered (the Roth page calls these the Future
            Contributions). Over the IRS limit the excess goes to a taxable account. For now each
            person&rsquo;s Roth and Pre-tax rows need one type and one account type.
          </p>
          <ul className="account-list">
            {rows.map((r, i) => (
              <li key={r.id} className="account-row">
                <div className="field-row">
                  <SelectInput
                    label="Type"
                    value={r.tax}
                    onChange={setRow('contributions', r.id, 'tax')}
                    options={labelOptions(CONTRIBUTION_TAX_LABELS)}
                  />
                  {r.tax !== 'taxable' && (
                    <SelectInput
                      label="Account"
                      value={r.account}
                      onChange={setRow('contributions', r.id, 'account')}
                      options={labelOptions(CONTRIBUTION_ACCOUNT_LABELS)}
                    />
                  )}
                </div>
                {spouse && <div className="field-row">{ownerSelect('contributions', r)}</div>}
                <CurrencyInput label="Amount (annual)" value={r.amount} onChange={setRow('contributions', r.id, 'amount')} />
                {r.tax !== 'taxable' && r.account === '401k' && (
                  <>
                    <div className="field-row">
                      <SelectInput
                        label="Employer contribution"
                        value={r.employer ?? 'none'}
                        onChange={setRow('contributions', r.id, 'employer')}
                        options={[
                          { value: 'none', label: 'None' },
                          { value: 'match', label: 'A match' },
                          { value: 'flat', label: 'A flat amount' },
                        ]}
                      />
                      {r.employer === 'match' && (
                        <>
                          <SelectInput
                            label="Matches"
                            value={r.matchRate}
                            onChange={setRow('contributions', r.id, 'matchRate')}
                            options={['0.25', '0.5', '0.75', '1'].map((x) => ({ value: x, label: `${Number(x) * 100}%` }))}
                          />
                          <SelectInput
                            label="Of pay up to"
                            value={r.matchUpTo}
                            onChange={setRow('contributions', r.id, 'matchUpTo')}
                            options={['0.03', '0.04', '0.05', '0.06', '0.08', '0.1'].map((x) => ({ value: x, label: `${Math.round(Number(x) * 100)}%` }))}
                          />
                        </>
                      )}
                      {r.employer === 'flat' && (
                        <CurrencyInput label="Employer amount (annual)" value={r.employerAmount} onChange={setRow('contributions', r.id, 'employerAmount')} />
                      )}
                    </div>
                    {r.employer === 'match' && (
                      <p className="hint">
                        {Number(r.matchRate) * 100}% of what is deferred, on deferrals up to {Math.round(Number(r.matchUpTo) * 100)}% of W-2 pay.
                        Pre-tax, into this 401(k), while working.
                      </p>
                    )}
                    {r.employer === 'flat' && <p className="hint">Pre-tax, into this 401(k), each year while working.</p>}
                  </>
                )}
                {removeButton('contributions', r, i, 'contribution')}
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={() => add('contributions')}>
            + Add a contribution
          </button>
        </>
      );
    },

    accounts: () => (
      <>
        <p className="hint">
          What is already saved today, one row per account (or per group of accounts); click a row to
          open it. Contributions are kept separate.
        </p>
        <ul className="account-list">
          {values.accounts.map((a, i) => {
            const isOpen = openRows.has(a.id);
            const bodyId = `${formId}-account-${a.id}`;
            return (
              <li key={a.id} className={isOpen ? 'account-row income-row open' : 'account-row income-row'}>
                <button
                  type="button"
                  className="income-row-head"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => setOpenRows((o) => toggleId(o, a.id))}
                >
                  <span className="collapsible-chevron" aria-hidden="true" />
                  <span>{accountRowSummary(a, spouse)}</span>
                </button>
                <div id={bodyId} className="income-row-body" hidden={!isOpen}>
                  <div className="field-row">
                    <SelectInput
                      label="Type"
                      value={a.type}
                      onChange={setRow('accounts', a.id, 'type')}
                      options={labelOptions(ACCOUNT_TYPE_LABELS)}
                    />
                    {ownerSelect('accounts', a)}
                  </div>
                  <CurrencyInput label="Balance" value={a.balance} onChange={setRow('accounts', a.id, 'balance')} />
                  {a.type === 'taxable' && (
                    <SelectInput
                      label="Cost basis"
                      value={a.basisShare}
                      onChange={setRow('accounts', a.id, 'basisShare')}
                      options={BASIS_OPTIONS}
                    />
                  )}
                  {a.type === 'taxable' && (
                    <SelectInput
                      label="Dividends per year"
                      value={a.dividendYield ?? ''}
                      onChange={setRow('accounts', a.id, 'dividendYield')}
                      options={[
                        { value: '', label: `As the assumption (${Math.round(Number(values.assumptions.dividendYield) * 1000) / 10}%)` },
                        { value: '0', label: 'None' },
                        ...['0.01', '0.015', '0.02', '0.03', '0.04'].map((x) => ({ value: x, label: `${Math.round(Number(x) * 1000) / 10}%` })),
                      ]}
                    />
                  )}
                  {a.type === 'taxable' && (
                    // One hint under both fields, so the two line up (decided 2026-10-09).
                    <p className="hint">
                      Cost basis: the share of today's balance that is money put in, not gains; only gains are taxed.
                      Dividends: qualified dividends as a share of the balance, counted in this year's tax and every
                      year of the projection.
                    </p>
                  )}
                  {values.accounts.length > 1 && removeButton('accounts', a, i, 'account')}
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setOpenRows((o) => new Set(o).add(newRowId(values.accounts, 'a')));
            add('accounts');
          }}
        >
          + Add an account
        </button>
      </>
    ),

    liabilities: () => (
      <>
        <p className="hint">
          Debts as they stand today. Not used by a calculator yet (the debt pay-off calculator comes
          later); payments that end by retirement are entered under Spending.
        </p>
        <ul className="account-list">
          {values.liabilities.map((l, i) => (
            <li key={l.id} className="account-row">
              <SelectInput
                label="Kind"
                value={l.kind}
                onChange={setRow('liabilities', l.id, 'kind')}
                options={labelOptions(LIABILITY_KIND_LABELS)}
              />
              <CurrencyInput label="Balance" value={l.balance} onChange={setRow('liabilities', l.id, 'balance')} />
              <div className="field-row">
                <TextField
                  label="Interest rate (%)"
                  inputMode="decimal"
                  placeholder="6.5"
                  value={l.rate}
                  onChange={setRow('liabilities', l.id, 'rate')}
                  clean={percent}
                />
                <CurrencyInput label="Payment (monthly)" value={l.payment} onChange={setRow('liabilities', l.id, 'payment')} />
              </div>
              {removeButton('liabilities', l, i, 'debt')}
            </li>
          ))}
        </ul>
        <button type="button" className="link-button" onClick={() => add('liabilities')}>
          + Add a debt
        </button>
      </>
    ),

    dependents: () => (
      <>
        <p className="hint">
          For the child tax credit: $2,200 for each child under 17 in 2026 (up to $1,700 of it paid out
          even with no tax owed), and $500 for each other dependent, reduced above $200,000 of income
          ($400,000 joint). Children count each year of the projection until they turn 17; other
          dependents count this year only.
        </p>
        <ul className="account-list">
          {(values.dependents ?? []).map((d, i) => (
            <li key={d.id} className="account-row">
              <SelectInput
                label="Who"
                value={d.kind}
                onChange={setRow('dependents', d.id, 'kind')}
                options={[
                  { value: 'child', label: 'Child' },
                  { value: 'other', label: 'Other dependent' },
                ]}
              />
              {d.kind === 'child' && <AgeInput label="Age this year" value={d.age} onChange={setRow('dependents', d.id, 'age')} />}
              {removeButton('dependents', d, i, 'dependent')}
            </li>
          ))}
        </ul>
        <button type="button" className="link-button" onClick={() => add('dependents')}>
          + Add a child or dependent
        </button>
      </>
    ),

    deductions: () => (
      <CurrencyInput
        label="Itemized deductions (total per year)"
        hint="Mortgage interest, state and local taxes (up to the cap), charitable gifts and other itemized deductions, as one total. Used instead of the standard deduction when it is larger, this year and every year of the projection. Leave blank for the standard deduction."
        value={values.deductions?.itemized ?? ''}
        onChange={setGroup('deductions', 'itemized')}
      />
    ),

    // Retirement spending from today's income (top-down) or the budget (phase 3, spendingNeed.js);
    // with everyone retired, only the budget applies.
    spending: () => {
      const retired = everyoneRetiredV2(values);
      const budget = retired || values.spending.method === 'budget';
      return (
        <>
          {!retired && (
            <RadioGroup
              legend="Base retirement spending on"
              name={`${formId}-spending-method`}
              value={values.spending.method ?? 'income'}
              onChange={setGroup('spending', 'method')}
              options={[
                { value: 'income', label: "Today's income" },
                { value: 'budget', label: 'The budget' },
              ]}
              hint="Today's income: take-home pay minus savings, what the paycheck leaves to spend. The budget: what the household says it spends."
            />
          )}
          {budget && (
            <CurrencyInput
              label="Baseline expenses per year (after tax)"
              hint={
                retired
                  ? 'Everything the household spends in a year, after tax. Everyone has retired, so this is the retirement spending every calculator uses.'
                  : 'Everything the household spends in a year today, after tax and not counting savings, including the costs below that end by retirement.'
              }
              value={values.spending.baseline ?? ''}
              onChange={setGroup('spending', 'baseline')}
            />
          )}
          {!retired && (
            <>
              <CurrencyInput
                label="Debt payments that will end by retirement (annual)"
                value={values.spending.debtPayments}
                onChange={setGroup('spending', 'debtPayments')}
              />
              <CurrencyInput
                label="Other expenses that will end by retirement (annual)"
                hint="For example private school or kids' college."
                value={values.spending.otherExpenses}
                onChange={setGroup('spending', 'otherExpenses')}
              />
              <SelectInput
                label="Expected retirement lifestyle"
                hint="Spending each year in retirement compared with today."
                value={values.spending.retirementLifestyle}
                onChange={setGroup('spending', 'retirementLifestyle')}
                options={LIFESTYLE_OPTIONS}
              />
            </>
          )}
        </>
      );
    },

    // The legacy goal (phase 3): what is left at the end of the plan, read by Retirement spending
    // and the projection's sustainable spending.
    legacy: () => {
      const l = values.legacy ?? { type: 'none', amount: '', share: '0.5', measure: 'balance' };
      const set = (field) => setGroup('legacy', field);
      return (
        <>
          <RadioGroup
            legend="Leave at the end of the plan"
            name={`${formId}-legacy-type`}
            value={l.type}
            onChange={set('type')}
            options={[
              { value: 'none', label: 'Nothing set' },
              { value: 'amount', label: 'An amount' },
              { value: 'share', label: "A share of today's portfolio" },
            ]}
            hint="For heirs (or charity), at the end of the plan: the second death for a couple. Spending is then the most that still leaves it."
          />
          {l.type === 'amount' && (
            <CurrencyInput label="Legacy goal (today's dollars)" value={l.amount} onChange={set('amount')} />
          )}
          {l.type === 'share' && (
            <SelectInput
              label="Share of today's portfolio"
              hint="Of every Existing Account's balance today, in today's dollars."
              value={l.share}
              onChange={set('share')}
              options={['0.1', '0.25', '0.5', '0.75', '1', '1.5', '2'].map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))}
            />
          )}
          {l.type !== 'none' && (
            <RadioGroup
              legend="Measured as"
              name={`${formId}-legacy-measure`}
              value={l.measure}
              onChange={set('measure')}
              options={[
                { value: 'balance', label: 'The balance' },
                { value: 'afterTax', label: 'After tax' },
              ]}
              hint="After tax counts Pre-tax money at the heirs' tax rate (Withdrawals); Roth and taxable money count in full."
            />
          )}
        </>
      );
    },

    assumptions: () => {
      const a = values.assumptions;
      const set = (field) => setGroup('assumptions', field);
      const shown = (field) => assumptionFields.has(field);
      return (
        <>
          {shown('returnRate') && (
            <SelectInput
              label="Expected annual investment return"
              hint="A return after inflation: everything is in today's dollars. Used until retirement, and after it unless set below."
              value={a.returnRate}
              onChange={set('returnRate')}
              options={RETURN_OPTIONS}
            />
          )}
          {shown('retirementReturnRate') && (
            <SelectInput
              label="Return in retirement"
              hint="After inflation, once no one in the household works (for a couple, from the year the last retires), for example a more conservative mix. Used by the projection and the pension calculator; the Roth comparison grows savings only until then."
              value={a.retirementReturnRate ?? 'same'}
              onChange={set('retirementReturnRate')}
              options={[
                { value: 'same', label: 'Same as before retirement' },
                ...['0.03', '0.04', '0.05', '0.06', '0.07', '0.08', '0.09'].map((x) => ({ value: x, label: `${Math.round(Number(x) * 100)}%` })),
              ]}
            />
          )}
          {shown('inflationRate') && (
            <SelectInput
              label="Inflation"
              hint="Everything is in today's dollars, so brackets and limits (which the law raises with inflation) stay put. The thresholds written as fixed dollar amounts don't rise: Social Security taxability, NIIT and Additional Medicare. At this rate they shrink, in today's dollars, until retirement."
              value={a.inflationRate}
              onChange={set('inflationRate')}
              options={INFLATION_OPTIONS}
            />
          )}
          {shown('ageDeductions') && (
            <RadioGroup
              legend="Age 65+ deductions in retirement"
              name={`${formId}-ageDeductions`}
              value={a.ageDeductions}
              onChange={set('ageDeductions')}
              options={[
                { value: 'yes', label: 'Include' },
                { value: 'no', label: 'Leave out (as the current calculator)' },
              ]}
              hint="The additional standard deduction at 65, and the senior deduction ($6,000 each, phased out above $75,000 / $150,000 of income). The senior deduction is law for 2025–2028 only and is applied when the retirement year falls in that window."
            />
          )}
          {shown('medicareIrmaa') && (
            <RadioGroup
              legend="Medicare IRMAA surcharges"
              name={`${formId}-medicareIrmaa`}
              value={a.medicareIrmaa}
              onChange={set('medicareIrmaa')}
              options={[
                { value: 'yes', label: 'Include' },
                { value: 'no', label: 'Leave out' },
              ]}
              hint="From 65, Medicare Part B and Part D premiums carry a surcharge when income two years earlier was above $109,000 ($218,000 joint) in 2026. Charged in the projection as a cost each year; the tax and Roth conversion pages show the effect of this year's income."
            />
          )}
          {shown('retirementRateShift') && (
            <SelectInput
              label="Tax rates in retirement (what-if)"
              hint="Added to every ordinary bracket rate in retirement years, in the Roth comparison and the projection. Current law has no scheduled change; this is a what-if."
              value={a.retirementRateShift}
              onChange={set('retirementRateShift')}
              options={[
                { value: '-0.02', label: '2 points lower' },
                { value: '0', label: 'Current law' },
                { value: '0.02', label: '2 points higher' },
                { value: '0.03', label: '3 points higher' },
                { value: '0.05', label: '5 points higher' },
                { value: '0.1', label: '10 points higher' },
              ]}
            />
          )}
          {shown('taxSavedBasis') && (
            <RadioGroup
              legend="Tax a Pre-tax contribution saves today"
              name={`${formId}-taxSavedBasis`}
              value={a.taxSavedBasis}
              onChange={set('taxSavedBasis')}
              options={[
                { value: 'average', label: 'Across the whole contribution' },
                { value: 'marginal', label: 'At the marginal rate (as the current calculator)' },
              ]}
              hint="A deduction that crosses a bracket edge saves the higher rate only on the part above the edge: $10,000 into the 22% bracket, a $20,000 deduction saves 22% on $10,000 and 12% on the rest, about 17%."
            />
          )}
          {shown('survivorSpending') && spouse && (
            <SelectInput
              label="Spending after the first death"
              hint="The survivor's spending each year, as a share of the couple's. The plan follows each person to their life expectancy; from the year after the first death the survivor files single."
              value={a.survivorSpending}
              onChange={set('survivorSpending')}
              options={['0.6', '0.7', '0.75', '0.8', '0.9', '1'].map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}% of the couple's` }))}
            />
          )}
          {shown('dividendYield') && (
            <SelectInput
              label="Dividends on taxable accounts"
              hint="Qualified dividends a taxable account pays each year, as part of the return (stock funds; a broad stock index fund pays about 1.3%). They are taxed every year, not only when sold: until anyone in the household retires, the account pays the tax and reinvests the rest; after that, the year's withdrawals cover it. Used by the Roth comparison and the projection."
              value={a.dividendYield}
              onChange={set('dividendYield')}
              options={[
                { value: '0', label: 'None' },
                { value: '0.01', label: '1%' },
                { value: '0.013', label: '1.3% (broad stock index fund)' },
                { value: '0.015', label: '1.5%' },
                { value: '0.02', label: '2%' },
                { value: '0.03', label: '3%' },
              ]}
            />
          )}
          {shown('surplus') && (
            <RadioGroup
              legend="Income above what is needed"
              name={`${formId}-surplus`}
              value={a.surplus ?? 'save'}
              onChange={set('surplus')}
              options={[
                { value: 'save', label: 'Save it' },
                { value: 'spend', label: 'Spend it' },
              ]}
              hint="Some years bring in more than spending, tax and savings use: an RMD larger than the need, rent or part-time work, Social Security plus a pension; before retirement, income beyond today's paycheck. Saved, it is reinvested in a taxable account; spent, spending rises in those years. The projection shows each year's."
            />
          )}
          {shown('strategy') && strategySelect()}
          {shown('heirTaxRate') && heirSelect()}
        </>
      );
    },

    projection: () => (
      <>
        {strategySelect()}
        {heirSelect()}
      </>
    ),

    conversion: () => (
      <CurrencyInput
        label="Convert to Roth this year"
        hint="Pre-tax dollars moved to Roth. Taxed this year as ordinary income, on top of this year's income."
        value={values.calculators.conversion.amount}
        onChange={setGroup('calculators.conversion', 'amount')}
      />
    ),

    pension: () => {
      const row = values.incomes.find((r) => r.type === 'pension' && people.some((p) => p.id === r.owner));
      return (
        <>
          {row ? (
            <>
              <p className="hint">The pension itself is an income row: changing it here changes it everywhere.</p>
              {spouse && <div className="field-row">{ownerSelect('incomes', row)}</div>}
              <div className="field-row">
                <CurrencyInput label="Monthly benefit" value={row.amount} onChange={setRow('incomes', row.id, 'amount')} />
                <AgeInput label="Starts at age" value={row.fromAge} onChange={setRow('incomes', row.id, 'fromAge')} />
              </div>
              <SelectInput label="Cost-of-living increase each year" value={row.cola} onChange={setRow('incomes', row.id, 'cola')} options={COLA_OPTIONS} />
              {spouse && (
                <SelectInput
                  label="Survivor benefit for the spouse"
                  hint="The share of the benefit the other spouse keeps."
                  value={row.survivorShare}
                  onChange={setRow('incomes', row.id, 'survivorShare')}
                  options={SURVIVOR_OPTIONS}
                />
              )}
              {pensionChoice(row)}
            </>
          ) : (
            <>
              <p className="hint">
                The household has no pension yet. Add one, with its monthly benefit and the lump sum offered instead; it joins the
                income rows.
              </p>
              <button type="button" className="button secondary" onClick={() => add('incomes', { type: 'pension', ...NEW_PENSION })}>
                Add a pension
              </button>
            </>
          )}
        </>
      );
    },
  };

  // mini: a section inside a group's block on the inputs page.
  const section = (sec, mini = false) => {
    const content = body[sec.id]();
    return (
      <Collapsible
        key={sec.id}
        variant={layout === 'page' ? 'card' : 'row'}
        className={mini ? `inputs-${sec.id} mini-block` : `inputs-${sec.id}`}
        title={titles[sec.id] ?? sec.title}
        summary={sec.summary(values)}
        changed={Boolean(baseValues) && sectionChanged(sec.id, baseValues, values)}
        open={open.has(sec.id)}
        onToggle={() => setOpen((o) => toggleId(o, sec.id))}
      >
        {locked ? (
          <fieldset className="locked-fieldset" disabled>
            {content}
          </fieldset>
        ) : (
          content
        )}
      </Collapsible>
    );
  };

  // The inputs page (decided 2026-10-09): each group is a block of its own, its sections smaller
  // blocks inside it; a group of one section (Assumptions) is just that section. Group ids are kept
  // in the same open set as section ids, prefixed "group:".
  const groupKey = (g) => `group:${g.id}`;
  const toggleable = [...sections.map((s) => s.id), ...(groups ?? []).filter((g) => g.sections.length > 1).map(groupKey)];
  const everyOpen = toggleable.every((id) => open.has(id));
  const head = (
    <div className="form-head">
      {title && <h2 className="form-title">{title}</h2>}
      <div className="form-head-actions">
        {headLink}
        <button type="button" className="link-button" onClick={() => setOpen(new Set(everyOpen ? [] : toggleable))}>
          {everyOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
    </div>
  );
  const lockedNote = locked && (
    <p className="alert locked-note">
      <strong>View only.</strong> These inputs came from a view-only link.{' '}
      <button type="button" className="link-button" onClick={onEditCopy}>
        Edit a copy
      </button>
    </p>
  );

  if (layout === 'page') {
    return (
      <form className="household-inputs-page" onSubmit={(e) => e.preventDefault()} noValidate>
        {head}
        {lockedNote}
        {groups ? (
          groups.map((g) => {
            const own = inputSections(g.sections);
            if (own.length === 1) return section(own[0]);
            return (
              <Collapsible
                key={g.id}
                className={`inputs-group inputs-group-${g.id}`}
                title={g.title}
                summary={
                  <span className="group-summary">
                    {own.map((sec) => (
                      <span key={sec.id}>
                        <strong>{sec.title}:</strong> {sec.summary(values)}
                      </span>
                    ))}
                  </span>
                }
                open={open.has(groupKey(g))}
                onToggle={() => setOpen((o) => toggleId(o, groupKey(g)))}
              >
                <div className="inputs-blocks">{own.map((sec) => section(sec, true))}</div>
              </Collapsible>
            );
          })
        ) : (
          <div className="inputs-blocks">{sections.map(section)}</div>
        )}
        {footer && <div className="card">{footer}</div>}
      </form>
    );
  }
  return (
    <form className="card input-form household-form" onSubmit={(e) => e.preventDefault()} noValidate>
      {head}
      {lockedNote}
      <div className="household-sections">{sections.map(section)}</div>
      {footer}
    </form>
  );
}
