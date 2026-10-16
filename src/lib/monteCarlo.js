// Monte Carlo (round 2 phase 8): random return paths for the projection. Pure. Decided with Michael
// 2026-10-16: the plan's two return inputs are the long-run compound growth (the median path), the
// volatility is the yearly swing of returns (the S&P 500's, about 20%, to start), 1,000 paths, and a
// seed so the same inputs always give the same answer.
//
// Each year's return is lognormal: 1 + R = (1 + g) × e^(σ z), z standard normal, g the plan's return
// for that year (before or after retirement). Its median is 1 + g, so with no volatility (σ = 0) every
// path is the projection. σ is set so the yearly returns' standard deviation is the volatility s:
// with x = e^(σ²), the mean of 1 + R is (1 + g)√x and its variance (1 + g)² x (x − 1) = s², so
// x = (1 + √(1 + 4 s² / (1 + g)²)) / 2.

// mulberry32: a small seeded generator, uniform on [0, 1). The same seed gives the same sequence.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draws from a uniform generator (Box-Muller, both values of each pair used).
export function normalDraws(random, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = 1 - random(); // (0, 1]: no log of 0
    const v = random();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

// σ of the log return for a compound growth g and a yearly standard deviation s (see the header).
export function logSigma(g, s) {
  if (!(s > 0)) return 0;
  const x = (1 + Math.sqrt(1 + (4 * s * s) / ((1 + g) * (1 + g)))) / 2;
  return Math.sqrt(Math.log(x));
}

// The yearly draws for every path: paths × years standard normals from the seed, path by path (so
// path k is the same whatever the number of paths after it).
export function returnShocks({ seed = 1, paths, years }) {
  const random = seededRandom(seed);
  return Array.from({ length: paths }, () => normalDraws(random, years));
}

// The projection's yearReturn for one path: the plan's return for the year, moved by that year's draw.
export function pathReturn(shocks, volatility) {
  const sigmas = new Map();
  const sigmaOf = (g) => {
    if (!sigmas.has(g)) sigmas.set(g, logSigma(g, volatility));
    return sigmas.get(g);
  };
  // No volatility: the plan's return itself ((1 + g) × 1 − 1 can differ from g in the last digit).
  return (rate, t) => {
    const shift = sigmaOf(rate) * (shocks[t] ?? 0);
    return shift === 0 ? rate : (1 + rate) * Math.exp(shift) - 1;
  };
}
