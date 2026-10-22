/**
 * Options strategies, priced with Black–Scholes so every curve, Greek, breakeven and max profit/loss is computed
 * from the legs rather than typed in. Conventions: stock at 100, 30 days to expiry, 25% implied vol, zero rates.
 */

export const S0 = 100;
export const DAYS = 30;
export const VOL = 0.25;

export interface Leg {
  kind: "call" | "put" | "stock";
  strike?: number;
  /** + bought, − sold. */
  qty: number;
  /** Days to expiry, if not the default 30. */
  days?: number;
}

export interface Strategy {
  id: string;
  name: string;
  /** The market view, in a few words. */
  view: string;
  legs: Leg[];
  /** How it works, in one line. */
  idea: string;
  /** A situation it suits, written without naming it (the use-case question). */
  useCase: string;
  /** Strategies with the same tag fit similar situations, so they never appear together in a use-case question. */
  tag: string;
  advanced?: boolean;
}

const C = (strike: number, qty = 1, days?: number): Leg => ({ kind: "call", strike, qty, days });
const P = (strike: number, qty = 1): Leg => ({ kind: "put", strike, qty });
const STOCK: Leg = { kind: "stock", qty: 1 };

export const STRATEGIES: Strategy[] = [
  {
    id: "long-call",
    name: "Long call",
    view: "Bullish",
    legs: [C(100)],
    idea: "Buy a call: the right to buy at the strike. You can lose only the premium; the upside is open.",
    useCase: "You expect a sharp rise and want leverage, with the most you can lose fixed at what you pay upfront.",
    tag: "bull",
  },
  {
    id: "long-put",
    name: "Long put",
    view: "Bearish",
    legs: [P(100)],
    idea: "Buy a put: profit as the stock falls below the strike. You can lose only the premium.",
    useCase: "You expect a sharp fall and want to profit from it while risking only what you pay upfront.",
    tag: "bear",
  },
  {
    id: "short-put",
    name: "Short put",
    view: "Neutral to bullish, income",
    legs: [P(95, -1)],
    idea: "Sell a put and keep the premium unless the stock drops below the strike, where you effectively buy it.",
    useCase: "You'd be happy to own the stock 5% lower and want to be paid while you wait.",
    tag: "income",
  },
  {
    id: "covered-call",
    name: "Covered call",
    view: "Neutral to mildly bullish, income",
    legs: [STOCK, C(105, -1)],
    idea: "Own the stock and sell a call above the market: extra income, upside capped at the strike.",
    useCase: "You already own the stock, expect it to drift sideways, and will give up a big rally for steady premium.",
    tag: "income",
  },
  {
    id: "protective-put",
    name: "Protective put",
    view: "Bullish, insured",
    legs: [STOCK, P(95)],
    idea: "Own the stock and buy a put below the market: insurance that puts a floor under your loss.",
    useCase: "You own the stock, want to keep all of the upside, and will pay for a floor in case it crashes.",
    tag: "hedge",
  },
  {
    id: "bull-call-spread",
    name: "Bull call spread",
    view: "Moderately bullish",
    legs: [C(95), C(105, -1)],
    idea: "Buy a lower-strike call and sell a higher one: cheaper than a call, gain capped at the upper strike.",
    useCase: "You expect a rise to a target, not beyond it, and want to cut the cost of buying calls.",
    tag: "bull",
  },
  {
    id: "bear-put-spread",
    name: "Bear put spread",
    view: "Moderately bearish",
    legs: [P(105), P(95, -1)],
    idea: "Buy a higher-strike put and sell a lower one: cheaper than a put, gain capped at the lower strike.",
    useCase: "You expect a fall to a target level and want a cheaper, capped version of buying puts.",
    tag: "bear",
  },
  {
    id: "bull-put-spread",
    name: "Bull put spread",
    view: "Neutral to bullish, credit",
    legs: [P(95, -1), P(90)],
    idea: "Sell a put and buy a lower one as protection: collect a credit and keep it if the stock stays above the short put.",
    useCase: "You think the stock holds above support and want to collect a credit with a defined worst case.",
    tag: "income",
  },
  {
    id: "bear-call-spread",
    name: "Bear call spread",
    view: "Neutral to bearish, credit",
    legs: [C(105, -1), C(110)],
    idea: "Sell a call and buy a higher one: collect a credit and keep it if the stock stays below the short call.",
    useCase: "You think the stock stays below resistance and want to collect a credit with capped risk.",
    tag: "bear-income",
  },
  {
    id: "long-straddle",
    name: "Long straddle",
    view: "Big move, either way",
    legs: [C(100), P(100)],
    idea: "Buy a call and a put at the same strike: win on a large move either way, lose both premiums if it sits still.",
    useCase: "Earnings are coming: you expect a big move but can't call the direction, and implied vol looks cheap.",
    tag: "long-vol",
  },
  {
    id: "short-straddle",
    name: "Short straddle",
    view: "Pinned, vol falling",
    legs: [C(100, -1), P(100, -1)],
    idea: "Sell a call and a put at the same strike: the most premium, but losses grow without limit on a big move.",
    useCase: "You expect the stock to sit right at today's price and implied vol to drop, and you accept open-ended risk.",
    tag: "short-vol",
  },
  {
    id: "long-strangle",
    name: "Long strangle",
    view: "Very big move, either way",
    legs: [C(105), P(95)],
    idea: "Buy a call above and a put below the market: cheaper than a straddle, but needs a bigger move.",
    useCase: "You expect a violent move either way and want a cheaper ticket than buying at-the-money options.",
    tag: "long-vol",
  },
  {
    id: "short-strangle",
    name: "Short strangle",
    view: "Range-bound",
    legs: [C(105, -1), P(95, -1)],
    idea: "Sell a call above and a put below the market: keep the premium inside the strikes; open-ended risk outside.",
    useCase: "You expect a wide trading range, implied vol is rich, and you're comfortable with unlimited tail risk.",
    tag: "short-vol",
  },
  {
    id: "iron-condor",
    name: "Iron condor",
    view: "Range-bound, defined risk",
    legs: [P(90), P(95, -1), C(105, -1), C(110)],
    idea: "Sell a strangle and buy wings further out: keep the credit between the short strikes; the wings cap the loss.",
    useCase: "You expect a range and rich implied vol, but you want both tails capped.",
    tag: "short-vol",
  },
  {
    id: "iron-butterfly",
    name: "Iron butterfly",
    view: "Pinned, defined risk",
    legs: [P(90), P(100, -1), C(100, -1), C(110)],
    idea: "Sell an at-the-money straddle and buy wings: a bigger credit than a condor, but the stock must stay near the middle.",
    useCase: "You expect the stock to pin near today's price and want straddle-like premium with capped losses.",
    tag: "short-vol",
  },
  {
    id: "long-call-butterfly",
    name: "Long call butterfly",
    view: "Pinned, cheap",
    legs: [C(95), C(100, -2), C(105)],
    idea: "Buy one low call, sell two middle calls, buy one high call: a small debit that pays most at the middle strike.",
    useCase: "You have a precise target for expiry and want a cheap, low-risk bet on the stock finishing right there.",
    tag: "short-vol",
  },
  {
    id: "collar",
    name: "Collar",
    view: "Hedged, low cost",
    legs: [STOCK, P(95), C(105, -1)],
    idea: "Own the stock, buy a put below and sell a call above: the call pays for the put; you trade upside for a floor.",
    useCase: "You own the stock, need downside protection, and want it to cost close to nothing by giving up upside.",
    tag: "hedge",
    advanced: true,
  },
  {
    id: "calendar",
    name: "Calendar spread",
    view: "Quiet now, vol holding",
    legs: [C(100, -1), C(100, 1, 60)],
    idea: "Sell a near-dated option and buy a longer-dated one at the same strike: the short leg decays faster.",
    useCase: "You expect the stock to stay near the strike this month while longer-dated implied vol holds up or rises.",
    tag: "time",
    advanced: true,
  },
  {
    id: "call-ratio-spread",
    name: "Call ratio spread",
    view: "Mildly bullish to a target",
    legs: [C(100), C(110, -2)],
    idea: "Buy one call and sell two higher calls: cheap or even a credit, best at the short strike, open-ended risk above.",
    useCase: "You expect a modest rise to a level and no further, want it for almost nothing, and accept risk on a big rally.",
    tag: "bull",
    advanced: true,
  },
  {
    id: "risk-reversal",
    name: "Risk reversal",
    view: "Bullish, financed",
    legs: [C(105), P(95, -1)],
    idea: "Buy a call above and sell a put below the market: long exposure for little or no premium.",
    useCase: "You're bullish and want to fund upside calls by selling downside puts, accepting you may have to buy lower.",
    tag: "bull",
    advanced: true,
  },
  {
    id: "synthetic-long",
    name: "Synthetic long stock",
    view: "Bullish, stock replacement",
    legs: [C(100), P(100, -1)],
    idea: "Buy a call and sell a put at the same strike: by put-call parity it behaves exactly like owning the stock.",
    useCase: "You want the payoff of owning the shares without paying for them upfront.",
    tag: "bull",
    advanced: true,
  },
  {
    id: "short-call",
    name: "Short call",
    view: "Bearish, income",
    legs: [C(105, -1)],
    idea: "Sell a call and keep the premium if the stock stays below the strike; losses on a rally have no limit.",
    useCase: "You think the stock won't rise past a level, want income, and accept unlimited risk on a squeeze.",
    tag: "bear-income",
    advanced: true,
  },
];

/* ------------------------------------------------------------ Black–Scholes */

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, error < 1.5e-7.
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const N = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

export interface Greeks {
  value: number;
  delta: number;
  gamma: number;
  /** Per day. */
  theta: number;
  /** Per vol point. */
  vega: number;
}

function option(kind: "call" | "put", S: number, K: number, days: number): Greeks {
  if (days <= 0) {
    const itm = kind === "call" ? S > K : S < K;
    return { value: Math.max(0, kind === "call" ? S - K : K - S), delta: itm ? (kind === "call" ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0 };
  }
  const T = days / 365;
  const sd = VOL * Math.sqrt(T);
  const d1 = (Math.log(S / K) + 0.5 * VOL * VOL * T) / sd;
  const d2 = d1 - sd;
  const call = S * N(d1) - K * N(d2);
  return {
    value: kind === "call" ? call : call - S + K,
    delta: kind === "call" ? N(d1) : N(d1) - 1,
    gamma: phi(d1) / (S * sd),
    theta: -(S * phi(d1) * VOL) / (2 * Math.sqrt(T)) / 365,
    vega: (S * phi(d1) * Math.sqrt(T)) / 100,
  };
}

/** The whole position at stock price S, `elapsed` days from now. */
export function position(st: Strategy, S: number, elapsed = 0): Greeks {
  const out = { value: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const leg of st.legs) {
    const g = leg.kind === "stock" ? { value: S, delta: 1, gamma: 0, theta: 0, vega: 0 } : option(leg.kind, Math.max(S, 0.01), leg.strike!, (leg.days ?? DAYS) - elapsed);
    out.value += leg.qty * g.value;
    out.delta += leg.qty * g.delta;
    out.gamma += leg.qty * g.gamma;
    out.theta += leg.qty * g.theta;
    out.vega += leg.qty * g.vega;
  }
  return out;
}

/** Days until the first option expires: the "expiry" curve is drawn there. */
export const horizon = (st: Strategy) => Math.min(...st.legs.filter((l) => l.kind !== "stock").map((l) => l.days ?? DAYS));
const cost = (st: Strategy) => position(st, S0).value;
/** Profit and loss at stock price S, either now (elapsed 0) or at the first expiry. */
export const pnl = (st: Strategy, S: number, atExpiry: boolean) => position(st, S, atExpiry ? horizon(st) : 0).value - cost(st);

/* --------------------------------------------------------------- the facts */

export type Sign = "+" | "−" | "≈0";
export const GREEKS = ["delta", "gamma", "theta", "vega"] as const;
export type GreekName = (typeof GREEKS)[number];
export const GREEK_LABEL: Record<GreekName, string> = { delta: "Delta Δ", gamma: "Gamma Γ", theta: "Theta Θ", vega: "Vega ν" };

const ATM = option("call", S0, S0, DAYS);
/** What counts as zero: a tenth of a share of delta, or 15% of one at-the-money option's gamma, theta or vega. */
const UNIT: Record<GreekName, { unit: number; tol: number }> = {
  delta: { unit: 1, tol: 0.1 },
  gamma: { unit: ATM.gamma, tol: 0.15 },
  theta: { unit: Math.abs(ATM.theta), tol: 0.15 },
  vega: { unit: ATM.vega, tol: 0.15 },
};

export interface Facts {
  greeks: Record<GreekName, { value: number; sign: Sign; accept: Sign[] }>;
  maxProfit: number | null;
  maxLoss: number | null;
  breakevens: number[];
  /** Net option premium: + paid (debit), − received (credit). */
  premium: number;
  hasStock: boolean;
  /** The expiry payoff's shape, as its run of slopes: equal shapes are synthetically the same trade. */
  signature: string;
}

const signOf = (r: number, tol: number): Sign => (Math.abs(r) < tol ? "≈0" : r > 0 ? "+" : "−");

export function facts(st: Strategy): Facts {
  const now = position(st, S0);
  const greeks = {} as Facts["greeks"];
  for (const g of GREEKS) {
    const { unit, tol } = UNIT[g];
    const r = now[g] / unit;
    const sign = signOf(r, tol);
    // Near the zero line both readings are fair.
    const accept = new Set<Sign>([sign]);
    if (Math.abs(Math.abs(r) - tol) < tol * 0.5) accept.add(sign === "≈0" ? (r > 0 ? "+" : "−") : "≈0");
    greeks[g] = { value: now[g], sign, accept: [...accept] };
  }

  const at = (S: number) => pnl(st, S, true);
  let hi = -Infinity;
  let lo = Infinity;
  for (let S = 0.01; S <= 400; S += 0.25) {
    const v = at(S);
    hi = Math.max(hi, v);
    lo = Math.min(lo, v);
  }
  const tail = at(400) - at(350);
  const breakevens: number[] = [];
  let prev = at(0.01);
  for (let S = 0.05; S <= 300; S += 0.05) {
    const v = at(S);
    if (Math.sign(v) !== Math.sign(prev) && prev !== 0) {
      const x = Math.round((S - 0.05 + (0.05 * Math.abs(prev)) / (Math.abs(prev) + Math.abs(v))) * 10) / 10;
      if (!breakevens.some((b) => Math.abs(b - x) < 0.5)) breakevens.push(x);
    }
    prev = v;
  }

  // Shape: slopes between strikes, rounded, with repeats collapsed.
  const slopes: string[] = [];
  for (let S = 60; S < 140; S += 1) {
    const s = (Math.round((at(S + 1) - at(S)) * 2) / 2).toString();
    if (slopes[slopes.length - 1] !== s) slopes.push(s);
  }

  const optionsOnly = { ...st, legs: st.legs.filter((l) => l.kind !== "stock") };
  return {
    greeks,
    maxProfit: tail > 5 ? null : hi,
    maxLoss: tail < -5 ? null : lo,
    breakevens,
    premium: cost(optionsOnly),
    hasStock: st.legs.some((l) => l.kind === "stock"),
    signature: slopes.join(","),
  };
}

export const legText = (l: Leg) =>
  l.kind === "stock"
    ? `${l.qty > 0 ? "Own" : "Short"} the stock`
    : `${l.qty > 0 ? "Buy" : "Sell"} ${Math.abs(l.qty) > 1 ? `${Math.abs(l.qty)}× ` : ""}${l.strike} ${l.kind}${l.days && l.days !== DAYS ? ` (${l.days}d)` : ""}`;
export const legsText = (st: Strategy) => st.legs.map(legText).join(" · ");

/* --------------------------------------------------------------- questions */

export type QType = "curve" | "greeks" | "usecase" | "legs" | "risk";
export const QTYPES: QType[] = ["curve", "greeks", "usecase", "legs", "risk"];

export type Question =
  | { type: QType; kind: "choice"; strategy: Strategy; prompt: string; options: string[]; answer: string }
  | { type: QType; kind: "grid"; strategy: Strategy; prompt: string; rows: string[]; options: string[]; answer: string[]; accept: string[][] };

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FACTS = new Map<string, Facts>();
export const factsOf = (st: Strategy) => {
  if (!FACTS.has(st.id)) FACTS.set(st.id, facts(st));
  return FACTS.get(st.id)!;
};

export function makeQuestion(st: Strategy, type: QType, deck: Strategy[], rand: () => number = Math.random): Question {
  const f = factsOf(st);
  const pick = (ok: (o: Strategy) => boolean, label: (o: Strategy) => string) => {
    const seen = new Set([label(st)]);
    const out: string[] = [];
    for (const o of shuffle(deck, rand)) {
      if (out.length === 3) break;
      if (o.id === st.id || !ok(o) || seen.has(label(o))) continue;
      seen.add(label(o));
      out.push(label(o));
    }
    return shuffle([label(st), ...out], rand);
  };

  if (type === "curve")
    return {
      type,
      kind: "choice",
      strategy: st,
      prompt: "Which strategy has this payoff?",
      // Synthetic twins (same shape, e.g. a covered call and a short put) are never offered against each other.
      options: pick((o) => factsOf(o).signature !== f.signature, (o) => o.name),
      answer: st.name,
    };
  if (type === "usecase")
    return { type, kind: "choice", strategy: st, prompt: st.useCase, options: pick((o) => o.tag !== st.tag, (o) => o.name), answer: st.name };
  if (type === "legs")
    return { type, kind: "choice", strategy: st, prompt: `How do you build a ${st.name.toLowerCase()}?`, options: pick(() => true, legsText), answer: legsText(st) };
  if (type === "greeks")
    return {
      type,
      kind: "grid",
      strategy: st,
      prompt: `${st.name}: the sign of each Greek with the stock at ${S0} and ${DAYS} days to go.`,
      rows: GREEKS.map((g) => GREEK_LABEL[g]),
      options: ["+", "≈0", "−"],
      answer: GREEKS.map((g) => f.greeks[g].sign),
      accept: GREEKS.map((g) => f.greeks[g].accept),
    };
  return {
    type,
    kind: "grid",
    strategy: st,
    prompt: `${st.name}: is the most you can make, and the most you can lose, limited or unlimited?`,
    rows: ["Max profit", "Max loss"],
    options: ["Limited", "Unlimited"],
    answer: [f.maxProfit === null ? "Unlimited" : "Limited", f.maxLoss === null ? "Unlimited" : "Limited"],
    accept: [[f.maxProfit === null ? "Unlimited" : "Limited"], [f.maxLoss === null ? "Unlimited" : "Limited"]],
  };
}

/** 1 for right, or the share of grid rows right. */
export function score(q: Question, a: string | string[] | null): number {
  if (q.kind === "choice") return a === q.answer ? 1 : 0;
  const given = Array.isArray(a) ? a : [];
  return q.accept.reduce((s, ok, i) => s + (ok.includes(given[i]) ? 1 : 0), 0) / q.rows.length;
}

/** A shuffled run of questions: every strategy before any repeats, question types rotating. */
export function makeQueue(deck: Strategy[], rounds: number, rand: () => number = Math.random): { id: string; type: QType }[] {
  const out: { id: string; type: QType }[] = [];
  let order: Strategy[] = [];
  let types: QType[] = [];
  while (out.length < rounds) {
    if (!order.length) order = shuffle(deck, rand);
    if (!types.length) types = shuffle(QTYPES, rand);
    out.push({ id: order.pop()!.id, type: types.pop()! });
  }
  return out;
}
