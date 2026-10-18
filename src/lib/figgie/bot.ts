import {
  ALL_LAYOUTS,
  GOAL_CARD_VALUE,
  POT,
  SUITS,
  bid,
  buy,
  counts,
  goalOf,
  offer,
  sell,
  type Figgie,
  type Hand,
  type Suit,
} from "./engine";

/**
 * Figgie bots. Each holds a belief over the 12 possible decks, starting from how likely its own dealt hand is
 * under each (multivariate hypergeometric) and leaning toward suits other players keep buying. From that it
 * prices every suit, then trades against mispriced quotes or posts its own, with a personality and noise so it
 * never plays the same way twice.
 */

export interface FiggiePersona {
  style: string;
  /** Edge it needs before taking a quote, in dollars. */
  edge: number;
  /** Half-spread it quotes around its value, in dollars. */
  spread: number;
  /** How often it acts on a tick (0–1). */
  activity: number;
  /** How much it reads into other players' buying. */
  readsFlow: number;
}

const STYLES: FiggiePersona[] = [
  { style: "Market maker", edge: 1.5, spread: 2, activity: 0.75, readsFlow: 0.5 },
  { style: "Sniper", edge: 3, spread: 4, activity: 0.45, readsFlow: 0.7 },
  { style: "Accumulator", edge: 1, spread: 2.5, activity: 0.6, readsFlow: 0.3 },
  { style: "Flow follower", edge: 2, spread: 3, activity: 0.6, readsFlow: 1 },
  { style: "Cautious", edge: 4, spread: 5, activity: 0.35, readsFlow: 0.4 },
];

export function randomFiggiePersona(rand: () => number = Math.random): FiggiePersona {
  const b = STYLES[Math.floor(rand() * STYLES.length)];
  const j = (x: number, k: number) => Math.max(0.1, x * (1 + (rand() - 0.5) * k));
  return { style: b.style, edge: j(b.edge, 0.6), spread: j(b.spread, 0.5), activity: Math.min(0.95, j(b.activity, 0.4)), readsFlow: j(b.readsFlow, 0.5) };
}

/* ----------------------------------------------------------------- beliefs */

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
  return s;
}

/** Probability that each suit is the goal suit, from one player's point of view. */
export function goalBeliefs(g: Figgie, seat: number, readsFlow = 0.6): Record<Suit, number> {
  const me = g.players[seat];
  // Net cards each other player has bought per suit: buying a suit hints they think it's the goal.
  const flow: Record<Suit, number> = { spades: 0, clubs: 0, hearts: 0, diamonds: 0 };
  for (const t of g.trades) {
    if (t.buyer !== seat) flow[t.suit] += 1;
    if (t.seller !== seat) flow[t.suit] -= 0.5;
  }
  const weights = ALL_LAYOUTS.map((l) => {
    const c = counts(l);
    // Likelihood of my dealt hand under this deck: product of C(count, held), the total draw being fixed.
    let w = 0;
    for (const s of SUITS) w += logChoose(c[s], me.dealt[s]);
    if (!Number.isFinite(w)) return 0;
    const goal = goalOf(l);
    return Math.exp(w + readsFlow * 0.18 * flow[goal]);
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const out: Record<Suit, number> = { spades: 0, clubs: 0, hearts: 0, diamonds: 0 };
  ALL_LAYOUTS.forEach((l, i) => (out[goalOf(l)] += weights[i] / total));
  return out;
}

/** Chance of holding the most goal cards with `mine`, against the others sharing the rest. */
function majorityChance(mine: number, goalTotal: number, players: number): number {
  const othersAvg = (goalTotal - mine) / Math.max(1, players - 1);
  const likelyMax = othersAvg * 1.55;
  return 1 / (1 + Math.exp(-(mine - likelyMax) * 1.4));
}

/** What one more card (buy) and one fewer card (sell) of each suit is worth to this player. */
export function cardValues(g: Figgie, seat: number, readsFlow = 0.6) {
  const me = g.players[seat];
  const belief = goalBeliefs(g, seat, readsFlow);
  const n = g.players.length;
  const buyV = {} as Record<Suit, number>;
  const sellV = {} as Record<Suit, number>;
  for (const s of SUITS) {
    // Expected goal-suit size if this suit is the goal (8 or 10 cards).
    const sizeIfGoal = expectedGoalSize(g, seat, s);
    const bonus = POT - GOAL_CARD_VALUE * sizeIfGoal;
    const m = me.hand[s];
    const up = majorityChance(m + 1, sizeIfGoal, n) - majorityChance(m, sizeIfGoal, n);
    const down = majorityChance(m, sizeIfGoal, n) - majorityChance(m - 1, sizeIfGoal, n);
    buyV[s] = belief[s] * (GOAL_CARD_VALUE + bonus * up);
    sellV[s] = belief[s] * (GOAL_CARD_VALUE + bonus * Math.max(0, down));
  }
  return { belief, buyV, sellV };
}

function expectedGoalSize(g: Figgie, seat: number, s: Suit): number {
  const me = g.players[seat];
  let w8 = 0;
  let w10 = 0;
  for (const l of ALL_LAYOUTS) {
    if (goalOf(l) !== s) continue;
    const c = counts(l);
    let w = 0;
    for (const t of SUITS) w += logChoose(c[t], me.dealt[t]);
    if (!Number.isFinite(w)) continue;
    if (c[s] === 8) w8 += Math.exp(w);
    else w10 += Math.exp(w);
  }
  return w8 + w10 > 0 ? (8 * w8 + 10 * w10) / (w8 + w10) : 9;
}

/* ------------------------------------------------------------------ acting */

/**
 * One bot decision. Returns the new game (or the same one when the bot chooses to wait).
 * `urgency` runs 0 → 1 over the round: spreads tighten and bots get keener as time runs out.
 */
export function botTick(g: Figgie, seat: number, me: FiggiePersona, urgency: number, rand: () => number = Math.random): Figgie {
  if (g.phase !== "trading" || rand() > me.activity) return g;
  const { buyV, sellV } = cardValues(g, seat, me.readsFlow);
  const p = g.players[seat];
  const noise = () => (rand() - 0.5) * 2;
  const edge = me.edge * (1 - urgency * 0.5);

  // 1. Take any quote that is clearly mispriced against this bot's value.
  const takes: { gain: number; run: () => Figgie | string }[] = [];
  for (const s of SUITS) {
    const q = g.book[s];
    if (q.ask && q.ask.player !== seat && p.cash >= q.ask.price) {
      const gain = buyV[s] + noise() - q.ask.price;
      if (gain > edge) takes.push({ gain, run: () => buy(g, seat, s) });
    }
    if (q.bid && q.bid.player !== seat && p.hand[s] > 0) {
      const gain = q.bid.price - (sellV[s] + noise());
      if (gain > edge) takes.push({ gain, run: () => sell(g, seat, s) });
    }
  }
  if (takes.length) {
    takes.sort((a, b) => b.gain - a.gain);
    const r = takes[0].run();
    if (typeof r !== "string") return r;
  }

  // 2. Otherwise improve a quote on a suit it cares about.
  const spread = Math.max(0.6, me.spread * (1 - urgency * 0.6));
  const order = [...SUITS].sort(() => rand() - 0.5);
  for (const s of order) {
    const q = g.book[s];
    const wantBid = Math.floor(buyV[s] - spread + noise() * 0.6);
    const wantAsk = Math.ceil(sellV[s] + spread + noise() * 0.6);
    const tryBid = wantBid >= 1 && (!q.bid || wantBid > q.bid.price) && wantBid <= p.cash && (!q.ask || wantBid < q.ask.price);
    const tryAsk = p.hand[s] > 0 && wantAsk >= 1 && (!q.ask || wantAsk < q.ask.price) && (!q.bid || wantAsk > q.bid.price);
    if (tryBid && (rand() < 0.5 || !tryAsk)) {
      const r = bid(g, seat, s, wantBid);
      if (typeof r !== "string") return r;
    }
    if (tryAsk) {
      const r = offer(g, seat, s, wantAsk);
      if (typeof r !== "string") return r;
    }
  }
  return g;
}

/** Values the human could see as a hint: the same model, without noise. */
export function fairValues(g: Figgie, seat: number): Hand {
  const { buyV } = cardValues(g, seat, 0.6);
  return { spades: Math.round(buyV.spades), clubs: Math.round(buyV.clubs), hearts: Math.round(buyV.hearts), diamonds: Math.round(buyV.diamonds) };
}
