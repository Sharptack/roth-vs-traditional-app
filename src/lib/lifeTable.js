// Survival from a period life table (round 2 phase 1: the pension on life expectancy). Pure.
//
// A table is { male: [q0, q1, ...], female: [...] }: q at each age = the chance of dying within the
// year (SSA's period life table, data/lifeTable.js; tests pass hand-made ones). Biological sex ''
// (not entered) uses the average of the two. Within a year of age, survival falls evenly in
// proportion: (1 − q)^(months / 12). Past the table's last age, no one survives.

export function deathRates(table, sex) {
  if (sex === 'male' || sex === 'female') return table[sex];
  return table.male.map((q, i) => (q + table.female[i]) / 2);
}

// The chance someone `age` today (a whole age, at the start of that year) is alive `months` later.
export function survival(qs, age, months) {
  let s = 1;
  let left = months;
  let a = age;
  while (left > 0) {
    if (a >= qs.length) return 0;
    const m = Math.min(12, left);
    s *= (1 - qs[a]) ** (m / 12);
    left -= m;
    a += 1;
  }
  return s;
}

// Survival month by month from `age`, months 0 .. until the table ends: curve[k] = alive k months on.
export function survivalCurve(qs, age) {
  const curve = [1];
  let s = 1;
  for (let a = age; a < qs.length; a++) {
    const monthly = (1 - qs[a]) ** (1 / 12);
    for (let m = 0; m < 12; m++) {
      s *= monthly;
      curve.push(s);
    }
  }
  return curve;
}

// Expected years of life left from `age`: each month counted by the chance of being alive through
// it, the average of its start and end (deaths spread through the month), ÷ 12.
export function lifeExpectancy(qs, age) {
  const c = survivalCurve(qs, age);
  let months = 0;
  for (let k = 1; k < c.length; k++) months += (c[k - 1] + c[k]) / 2;
  return months / 12;
}
