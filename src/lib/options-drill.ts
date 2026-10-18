/**
 * Options speed drill: rapid mental-math questions of the kind market-making firms ask in first rounds —
 * put-call parity, ATM approximations, delta hedges, payoffs at expiry, Greeks P&L, boxes and synthetics.
 * Rates are zero unless the question gives one. Every question has a single numeric answer and a tolerance.
 */

export type Level = 1 | 2 | 3;

export interface Question {
  topic: string;
  facts: { label: string; value: string }[];
  ask: string;
  answer: number;
  /** Absolute tolerance on the answer. */
  tol: number;
  /** One-line working, shown when you miss. */
  why: string;
}

type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
/** A price with `dp` decimals: whole dollars at level 1, quarters at 2, cents-ish at 3. */
const price = (r: Rand, lo: number, hi: number, level: Level) => {
  const step = level === 1 ? 1 : level === 2 ? 0.25 : 0.05;
  return round(lo + Math.floor(r() * ((hi - lo) / step + 1)) * step);
};
const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

export const fmt = (x: number) => {
  const r = round(x);
  return r.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
const usd = (x: number) => `$${fmt(x)}`;

/* -------------------------------------------------------------- questions */

function parity(r: Rand, level: Level): Question {
  const K = pick(r, [50, 80, 100, 120, 150, 200]);
  const S = round(K + price(r, -12, 12, level));
  const rate = level === 3 ? pick(r, [0.02, 0.04, 0.05, 0.06]) : 0;
  const T = level === 3 ? pick(r, [0.25, 0.5, 1]) : 0;
  const pvK = K * Math.exp(-rate * T);
  // Accept the mental shortcut K(1 − rT) as well as the exact discount.
  const shortcutGap = Math.abs(K * (1 - rate * T) - pvK);
  const callAsk = r() < 0.5;
  // Keep both options worth something.
  const intrinsicC = Math.max(0, S - pvK);
  const C = round(intrinsicC + price(r, 1, 8, level));
  const P = round(C - S + pvK);
  const facts = [
    { label: "Stock", value: usd(S) },
    { label: "Strike", value: usd(K) },
    ...(rate ? [{ label: "Rate · expiry", value: `${rate * 100}% · ${T}y` }] : []),
    callAsk ? { label: "Put", value: usd(P) } : { label: "Call", value: usd(C) },
  ];
  return {
    topic: "Put-call parity",
    facts,
    ask: callAsk ? "Call price?" : "Put price?",
    answer: callAsk ? C : P,
    tol: rate ? shortcutGap + 0.1 : 0.01,
    why: rate ? `C − P = S − K·e^(−rT) = ${fmt(S - pvK)} (≈ S − K(1 − rT))` : `C − P = S − K = ${fmt(S - K)}`,
  };
}

/** Trading days with a tidy square root on a 256-day year. */
const DAYS = [
  { d: 4, sq: 0.125 },
  { d: 16, sq: 0.25 },
  { d: 36, sq: 0.375 },
  { d: 64, sq: 0.5 },
  { d: 144, sq: 0.75 },
  { d: 256, sq: 1 },
];

function atm(r: Rand, level: Level): Question {
  const S = level === 1 ? pick(r, [50, 100, 200, 400]) : pick(r, [40, 60, 80, 120, 150, 250]);
  const vol = pick(r, level === 1 ? [10, 20, 40] : [15, 20, 25, 30, 32, 45]);
  const t = pick(r, DAYS);
  const straddle = r() < 0.5;
  const k = straddle ? 0.8 : 0.4;
  const answer = k * (vol / 100) * S * t.sq;
  return {
    topic: straddle ? "ATM straddle" : "ATM call",
    facts: [
      { label: "Stock", value: usd(S) },
      { label: "Vol", value: `${vol}%` },
      { label: "Expiry", value: `${t.d} trading days` },
    ],
    ask: `${straddle ? "Straddle" : "Call"} price? (256-day year)`,
    answer,
    tol: Math.max(0.05, answer * 0.05),
    why: `${k}·σ·S·√T = ${k} × ${vol / 100} × ${S} × ${t.sq} = ${fmt(answer)}`,
  };
}

function hedge(r: Rand, level: Level): Question {
  const n = level === 1 ? pick(r, [10, 20, 50]) : int(r, 4, 60);
  const delta = level === 1 ? pick(r, [0.25, 0.5, 0.75]) : pick(r, [0.15, 0.3, 0.35, 0.4, 0.45, 0.6, 0.65, 0.8]);
  const long = r() < 0.5;
  const call = level === 1 ? true : r() < 0.5;
  // Position delta in shares; the hedge is the opposite trade.
  const posDelta = (long ? 1 : -1) * (call ? 1 : -1) * delta * n * 100;
  const answer = -posDelta;
  return {
    topic: "Delta hedge",
    facts: [
      { label: "Position", value: `${long ? "Long" : "Short"} ${n} ${call ? "calls" : "puts"}` },
      { label: `${call ? "Call" : "Put"} delta`, value: `${call ? "" : "−"}${delta}` },
      { label: "Contract", value: "100 shares" },
    ],
    ask: "Shares to trade? (+ buy, − sell)",
    answer,
    tol: 0.5,
    why: `Position delta = ${fmt(posDelta)} shares, so ${answer > 0 ? "buy" : "sell"} ${fmt(Math.abs(answer))}`,
  };
}

function payoff(r: Rand, level: Level): Question {
  const w = pick(r, level === 1 ? [5, 10] : [5, 10, 15, 20]);
  const K = pick(r, [50, 90, 100, 110, 150]);
  const kinds = level === 1 ? (["call spread", "straddle"] as const) : (["call spread", "put spread", "butterfly", "straddle"] as const);
  const kind = pick(r, kinds);
  const S = K + int(r, -w * 2, w * 2) + (level === 3 ? pick(r, [0, 0.5]) : 0);
  let answer: number;
  let label: string;
  let why: string;
  if (kind === "call spread") {
    answer = Math.min(Math.max(0, S - K), w);
    label = `Long ${K}/${K + w} call spread`;
    why = `min(max(0, ${S} − ${K}), ${w})`;
  } else if (kind === "put spread") {
    answer = Math.min(Math.max(0, K + w - S), w);
    label = `Long ${K + w}/${K} put spread`;
    why = `min(max(0, ${K + w} − ${S}), ${w})`;
  } else if (kind === "butterfly") {
    answer = Math.max(0, w - Math.abs(S - (K + w)));
    label = `Long ${K}/${K + w}/${K + 2 * w} call fly`;
    why = `max(0, ${w} − |${S} − ${K + w}|)`;
  } else {
    answer = Math.abs(S - K);
    label = `Long ${K} straddle`;
    why = `|${S} − ${K}|`;
  }
  const qty = level === 3 ? int(r, 2, 9) : 1;
  return {
    topic: "Payoff at expiry",
    facts: [
      { label: "Position", value: qty > 1 ? `${qty} × ${label}` : label },
      { label: "Stock at expiry", value: usd(S) },
    ],
    ask: "Value at expiry?",
    answer: answer * qty,
    tol: 0.01,
    why: `${qty > 1 ? `${qty} × ` : ""}${why} = ${fmt(answer * qty)}`,
  };
}

function greeks(r: Rand, level: Level): Question {
  const kind = level === 1 ? "vega" : pick(r, level === 2 ? (["vega", "gamma", "theta"] as const) : (["gamma+theta", "vega", "gamma"] as const));
  if (kind === "vega") {
    const vega = pick(r, [20, 50, 75, 120, 250, 400]);
    const dv = pick(r, level === 1 ? [1, 2, -1, -2] : [1.5, 2, -0.5, -3, 4]);
    const answer = vega * dv;
    return {
      topic: "Vega P&L",
      facts: [
        { label: "Your vega", value: `${usd(vega)} per vol pt` },
        { label: "Implied vol", value: `${dv > 0 ? "+" : "−"}${Math.abs(dv)} pts` },
      ],
      ask: "P&L?",
      answer,
      tol: 0.5,
      why: `${vega} × ${dv} = ${fmt(answer)}`,
    };
  }
  if (kind === "theta") {
    const theta = pick(r, [-15, -40, -60, -125]);
    const days = pick(r, [1, 3, 5]);
    return {
      topic: "Theta P&L",
      facts: [
        { label: "Your theta", value: `${usd(theta)} per day` },
        { label: "Time passes", value: `${days} day${days > 1 ? "s" : ""}, nothing moves` },
      ],
      ask: "P&L?",
      answer: theta * days,
      tol: 0.5,
      why: `${theta} × ${days} = ${theta * days}`,
    };
  }
  const gamma = pick(r, [10, 20, 40, 50, 100]);
  const dS = pick(r, [1, 2, 3, -2, -4]);
  const g = 0.5 * gamma * dS * dS;
  const theta = kind === "gamma+theta" ? -pick(r, [20, 40, 60, 80]) : 0;
  return {
    topic: theta ? "Gamma vs theta" : "Gamma P&L",
    facts: [
      { label: "Delta-hedged, gamma", value: `${gamma} shares per $1` },
      { label: "Stock moves", value: `${dS > 0 ? "+" : "−"}$${Math.abs(dS)}` },
      ...(theta ? [{ label: "Theta (one day)", value: usd(theta) }] : []),
    ],
    ask: theta ? "P&L over the day?" : "P&L?",
    answer: g + theta,
    tol: 0.5,
    why: `½ × ${gamma} × ${dS}² = ${fmt(g)}${theta ? `, ${theta} theta → ${fmt(g + theta)}` : ""}`,
  };
}

function box(r: Rand, level: Level): Question {
  const K1 = pick(r, [80, 90, 100]);
  const w = pick(r, [10, 20, 25, 40]);
  const rate = level === 1 ? 0 : pick(r, [0.02, 0.04, 0.05, 0.1]);
  const T = level === 1 ? 1 : pick(r, [0.25, 0.5, 1]);
  const answer = w * Math.exp(-rate * T);
  return {
    topic: "Box spread",
    facts: [
      { label: "Strikes", value: `${K1} / ${K1 + w}` },
      { label: "Rate · expiry", value: rate ? `${rate * 100}% · ${T}y` : "0% · 1y" },
    ],
    ask: "Fair value of the box?",
    answer,
    tol: rate ? Math.abs(w * (1 - rate * T) - answer) + 0.05 : 0.01,
    why: `(K₂ − K₁)·e^(−rT) = ${w} × ${rate ? fmt(Math.exp(-rate * T)) : 1} ≈ ${fmt(answer)}`,
  };
}

function synthetic(r: Rand, level: Level): Question {
  const K = pick(r, [50, 100, 120, 200]);
  const C = price(r, 2, 12, level);
  const P = price(r, 2, 12, level);
  const F = round(K + C - P);
  return {
    topic: "Synthetic forward",
    facts: [
      { label: "Strike", value: usd(K) },
      { label: "Call", value: usd(C) },
      { label: "Put", value: usd(P) },
    ],
    ask: "Implied forward (stock) price?",
    answer: F,
    tol: 0.01,
    why: `Long call + short put = forward at K: ${K} + ${fmt(C)} − ${fmt(P)} = ${fmt(F)}`,
  };
}

const MAKERS: Record<Level, ((r: Rand, l: Level) => Question)[]> = {
  1: [parity, atm, hedge, payoff, greeks, synthetic],
  2: [parity, atm, hedge, payoff, greeks, synthetic, box],
  3: [parity, atm, hedge, payoff, greeks, box],
};

export function makeQuestion(level: Level, last?: string, r: Rand = Math.random): Question {
  // Never the same topic twice in a row.
  for (;;) {
    const q = pick(r, MAKERS[level])(r, level);
    if (q.topic !== last) return q;
  }
}

/** Reads "1,200", "-4.5", "−3" or "$12". Null when it isn't a number. */
export function parseAnswer(s: string): number | null {
  const t = s.replace(/[,$\s]/g, "").replace(/[−–]/g, "-");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

export const isRight = (q: Question, x: number) => Math.abs(x - q.answer) <= q.tol + 1e-9;
