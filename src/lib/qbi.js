// The qualified business income (QBI) deduction, IRC §199A, basic rule (round 2 phase 1). Pure.
//
//   deduction = the smaller of
//     20% × QBI, reduced across the phase-in range above the threshold, and
//     20% × (taxable income before this deduction − net capital gain)
//   and from 2026 at least $400 when QBI is at least $1,000 (never more than taxable income).
//
// Above the threshold, this assumes a business with no W-2 employees and no business property,
// the usual 1099 earner: its wage-and-property limit is then $0, so the 20% shrinks in a straight
// line to nothing across the phase-in range. That is also the rule for a specified service
// business (doctors, lawyers, consultants, financial advisors). Businesses with employees or
// property can keep more above the threshold; that limit is an advanced-round item.
//
// QBI here = net 1099 earnings less the deductible half of self-employment tax. Not modeled: the
// further reductions for self-employed health insurance and for retirement contributions made
// for the business (a solo 401(k) or SEP), REIT dividends and publicly traded partnership income.
import { QBI } from '../data/qbi.js';
import { getYearData } from './yearLookup.js';

export const QBI_RATE = 0.2;

// qbi: qualified business income; taxableIncome: taxable income before the QBI deduction;
// netCapitalGain: qualified dividends and long-term gains (taxed at the capital-gains rates).
// -> { deduction, tentative, limit, phaseIn (0 below the threshold .. 1 at its end), minimumApplied }
export function qbiDeduction({ qbi, taxableIncome, netCapitalGain = 0, filingStatus, year }) {
  const none = { deduction: 0, tentative: 0, limit: 0, phaseIn: 0, minimumApplied: false };
  if (!(qbi > 0) || !(taxableIncome > 0)) return none;
  const { data } = getYearData(QBI, year);
  const { threshold, phaseInEnd } = data[filingStatus];
  const phaseIn = Math.min(1, Math.max(0, (taxableIncome - threshold) / (phaseInEnd - threshold)));
  const tentative = QBI_RATE * qbi * (1 - phaseIn);
  const limit = QBI_RATE * Math.max(0, taxableIncome - Math.max(0, netCapitalGain));
  let deduction = Math.min(tentative, limit);
  let minimumApplied = false;
  const min = data.minimum;
  if (min && qbi >= min.qbi && deduction < min.amount) {
    deduction = Math.min(min.amount, taxableIncome);
    minimumApplied = true;
  }
  return { deduction, tentative, limit, phaseIn, minimumApplied };
}
