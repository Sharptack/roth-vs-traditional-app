// Named assumptions used across the calculation layer. Nothing in here depends
// on React.

// Safe-withdrawal-rate rule of thumb: 4% of the balance per year.
export const WITHDRAWAL_RATE = 0.04;

// "At/near" a contribution limit means >= this share of the limit.
export const CONTRIBUTION_LIMIT_THRESHOLD = 0.9;

// Valid option values, shared by validation and the UI.
export const FILING_STATUSES = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
};

export const ACCOUNT_TYPES = {
  '401k': '401(k)',
  ira: 'IRA',
};

export const CONTRIBUTION_TYPES = {
  pretax: 'Pre-tax (Traditional)',
  roth: 'Roth',
};
