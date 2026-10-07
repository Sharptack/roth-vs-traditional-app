// Every calculator's results for one preview household, as NextApp works them out, reduced to
// numbers that can be pinned in a snapshot (tests/householdV1Pins.test.js). Round 2 phase 0.
import { previewResult } from '../../src/next/NextApp.jsx';
import { householdToCompareInputs } from '../../src/lib/household.js';
import { householdToYearTaxParams, taxCalculatorResult } from '../../src/lib/taxCalculator.js';
import { conversionResult } from '../../src/lib/conversionCalculator.js';
import { householdToPensionInputs, pensionResult } from '../../src/lib/pensionCalculator.js';
import { projectionView } from '../../src/lib/projectionSummary.js';
import { compareLifetime } from '../../src/lib/lifetimeComparison.js';
import { strategyById } from '../../src/lib/strategies.js';
import { compareRothVsTraditional } from '../../src/lib/compare.js';
import { toHouseholdV2, validateHouseholdV2 } from '../../src/lib/householdV2.js';

export const YEAR = 2026;

// Numbers rounded to 1e-6 (so a harmless floating-point difference doesn't count as a change);
// objects kept to their scalars, `depth` levels down; arrays left out unless listed.
const round = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : n);
function scalars(obj, depth = 2) {
  if (obj === null || typeof obj !== 'object') return typeof obj === 'number' ? round(obj) : obj;
  if (Array.isArray(obj)) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'function') continue;
    if (v !== null && typeof v === 'object') {
      if (depth > 0 && !Array.isArray(v)) out[k] = scalars(v, depth - 1);
    } else {
      out[k] = scalars(v);
    }
  }
  return out;
}

// Each calculator's results for one version 1 household (form values), as NextApp works them out.
export function pinsFor(values) {
  return pinsFromPreview(previewResult(values, YEAR, { blend: false }));
}

// The same for version 2 values: the household from toHouseholdV2, its errors merged the way
// NextApp's previewResult merges them.
export function pinsForV2(values) {
  const household = toHouseholdV2(values, YEAR);
  const householdErrors = validateHouseholdV2(household);
  const result = compareRothVsTraditional({ ...householdToCompareInputs(household), skipBlend: true });
  if (householdErrors.length === 0) return pinsFromPreview({ household, result });
  return pinsFromPreview({ household, result: { valid: false, errors: [...(result.valid ? [] : result.errors), ...householdErrors] } });
}

function pinsFromPreview({ household, result }) {
  const pins = { compareInputs: scalars(householdToCompareInputs(household), 3) };
  pins.roth = result.valid
    ? {
        ...scalars(result, 2),
        sideAware: scalars({ ...result.sideAware, stacks: undefined, stackDetails: undefined }, 1),
      }
    : { valid: false, errors: result.errors };
  const irmaa = { irmaa: Boolean(household.assumptions.medicareIrmaa) };
  const params = householdToYearTaxParams(household);
  const tax = taxCalculatorResult(params, irmaa);
  pins.tax = { ...scalars(tax.result, 1), marginal: scalars(tax.marginal), irmaa: scalars(tax.irmaa, 1) };
  pins.conversion = scalars(conversionResult(params, household.calculators.conversion.amount, irmaa), 2);
  const pensionInputs = householdToPensionInputs(household);
  pins.pension = { inputs: scalars(pensionInputs), result: scalars(pensionResult(pensionInputs), 1) };
  if (result.valid) {
    const view = projectionView(household, result.retirementNeed.target);
    pins.projection = {
      ...scalars(view, 1),
      strategies: view.strategies.map((s) => scalars(s, 1)),
    };
    const own = household.calculators.projection;
    const lifetime = compareLifetime(household, result, {
      endAge: own.endAge,
      heirTaxRate: own.heirTaxRate,
      strategy: strategyById(own.strategy),
    });
    pins.lifetime = {
      ...scalars(lifetime, 1),
      roth: scalars({ ...lifetime.roth, rows: undefined }, 1),
      pretax: scalars({ ...lifetime.pretax, rows: undefined }, 1),
    };
  }
  return pins;
}
