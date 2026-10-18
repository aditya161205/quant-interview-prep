import { rankOf, suitOf, type Card } from "./cards";
import { evaluate } from "./evaluate";
import { canAct, inHand, legal, potTotal, type Action, type Game, type Player } from "./engine";

/**
 * Bot decisions. Each bot has a personality drawn fresh every game, and every decision mixes:
 * - equity from a Monte Carlo run-out against opponents' likely ranges (narrowed by how they've acted),
 * - pot odds, position, stack depth and board, and
 * - randomness in both the choice (mixed strategies) and the bet size,
 * so the same spot is not always played the same way. Bots also read the human's tendencies.
 */

export interface Personality {
  style: string;
  /** How many hands it plays (0 tight … 1 loose). */
  looseness: number;
  /** Betting and raising versus checking and calling. */
  aggression: number;
  /** Willingness to bet or raise with weak hands. */
  bluff: number;
  /** Calling down with marginal hands. */
  stickiness: number;
  /** Slow-playing strong hands. */
  trapping: number;
}

const ARCHETYPES: Personality[] = [
  { style: "Rock", looseness: 0.15, aggression: 0.35, bluff: 0.08, stickiness: 0.2, trapping: 0.15 },
  { style: "Tight-aggressive", looseness: 0.35, aggression: 0.7, bluff: 0.3, stickiness: 0.3, trapping: 0.25 },
  { style: "Loose-aggressive", looseness: 0.65, aggression: 0.8, bluff: 0.5, stickiness: 0.35, trapping: 0.2 },
  { style: "Calling station", looseness: 0.7, aggression: 0.2, bluff: 0.08, stickiness: 0.85, trapping: 0.1 },
  { style: "Maniac", looseness: 0.85, aggression: 0.9, bluff: 0.7, stickiness: 0.45, trapping: 0.05 },
  { style: "Tricky", looseness: 0.45, aggression: 0.55, bluff: 0.4, stickiness: 0.4, trapping: 0.6 },
  { style: "Solid", looseness: 0.4, aggression: 0.6, bluff: 0.25, stickiness: 0.4, trapping: 0.3 },
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A personality from a random archetype, each trait jittered so no two games share a table image. */
export function randomPersonality(rand: () => number = Math.random): Personality {
  const base = ARCHETYPES[Math.floor(rand() * ARCHETYPES.length)];
  const j = (x: number) => clamp01(x + (rand() - 0.5) * 0.2);
  return {
    style: base.style,
    looseness: j(base.looseness),
    aggression: j(base.aggression),
    bluff: j(base.bluff),
    stickiness: j(base.stickiness),
    trapping: j(base.trapping),
  };
}

/** What the bots have learned about the human this game. */
export interface HumanModel {
  hands: number;
  voluntary: number;
  raises: number;
  calls: number;
  betsFaced: number;
  foldsToBet: number;
}

export const emptyModel = (): HumanModel => ({ hands: 0, voluntary: 0, raises: 0, calls: 0, betsFaced: 0, foldsToBet: 0 });

/* --------------------------------------------------------------- hand strength */

/** Chen-formula preflop strength, scaled to roughly 0 (72o) … 1 (AA). */
export function preflopStrength(hole: Card[]): number {
  const [a, b] = hole;
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  const points = (r: number) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  let s = points(hi);
  if (hi === lo) s = Math.max(5, s * 2);
  if (suitOf(a) === suitOf(b)) s += 2;
  const gap = hi - lo - 1;
  if (hi !== lo) {
    s -= gap <= 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 10) s += 1;
  }
  return clamp01((s + 1) / 21);
}

/** How strong a range this player is representing, as a minimum preflop strength their hand should meet. */
function rangeFloor(p: Player, g: Game, model: HumanModel): number {
  let floor = 0;
  if (p.voluntary) floor = 0.32;
  if (p.handRaises >= 1) floor = 0.45;
  if (p.handRaises >= 2) floor = 0.58;
  if (p.handRaises >= 3 || p.allIn) floor = Math.max(floor, 0.62);
  if (p.human && model.hands >= 8) {
    // Loose or hyper-aggressive humans get wider ranges credited to them.
    const vpip = model.voluntary / model.hands;
    const aggr = model.raises / Math.max(1, model.raises + model.calls);
    floor -= (vpip - 0.3) * 0.25 + (aggr - 0.4) * 0.15;
  }
  // Big blind or limped pots: anything goes.
  if (!p.voluntary && g.street !== "preflop") floor = Math.min(floor, 0.1);
  return Math.max(0, Math.min(0.7, floor));
}

/** Probability of winning (ties shared) by simulating run-outs against range-weighted opponent hands. */
export function equity(g: Game, seat: number, model: HumanModel, sims: number, rand: () => number = Math.random): number {
  const me = g.players[seat];
  const opponents = g.players.filter((p) => inHand(p) && p.id !== seat);
  if (opponents.length === 0) return 1;
  const floors = opponents.map((p) => rangeFloor(p, g, model));
  const known = new Set<Card>([...me.hole, ...g.board]);
  const stub = Array.from({ length: 52 }, (_, i) => i).filter((c) => !known.has(c));

  let won = 0;
  for (let s = 0; s < sims; s++) {
    const deck = [...stub];
    const draw = () => {
      const i = Math.floor(rand() * deck.length);
      const c = deck[i];
      deck[i] = deck[deck.length - 1];
      deck.pop();
      return c;
    };
    const hands: Card[][] = [];
    for (let o = 0; o < opponents.length; o++) {
      // Rejection-sample a hand that fits the range they've shown, with a small leak for unexpected holdings.
      let hand: Card[] = [];
      for (let tries = 0; tries < 12; tries++) {
        const h = [draw(), draw()];
        if (preflopStrength(h) >= floors[o] || rand() < 0.08 || tries === 11) {
          hand = h;
          break;
        }
        deck.push(h[0], h[1]);
      }
      hands.push(hand);
    }
    const board = [...g.board];
    while (board.length < 5) board.push(draw());
    const mine = evaluate([...me.hole, ...board]);
    let best = true;
    let ties = 1;
    for (const h of hands) {
      const v = evaluate([...h, ...board]);
      if (v > mine) {
        best = false;
        break;
      }
      if (v === mine) ties++;
    }
    if (best) won += 1 / ties;
  }
  return won / sims;
}

/* ------------------------------------------------------------------- decide */

/** Seats left to act after this one on the street, as a 0 (first) … 1 (last) position. */
function positionFactor(g: Game, seat: number): number {
  const n = g.players.length;
  const order: number[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (g.dealer + k) % n;
    if (canAct(g.players[i]) || i === seat) order.push(i);
  }
  const idx = order.indexOf(seat);
  return order.length <= 1 ? 1 : idx / (order.length - 1);
}


export function decide(g: Game, seat: number, me: Personality, model: HumanModel, rand: () => number = Math.random): Action {
  const p = g.players[seat];
  const L = legal(g, seat);
  const pot = potTotal(g);
  const bb = g.bb;
  const stackBb = (p.stack + p.bet) / bb;
  const pos = positionFactor(g, seat);
  const opponents = g.players.filter((q) => inHand(q) && q.id !== seat).length;
  const humanInHand = g.players[0].id !== seat && inHand(g.players[0]);
  // Per-decision mood: the same hand in the same spot does not always get the same play.
  const mood = (rand() - 0.5) * 0.12;

  const raiseTo = (to: number): Action => {
    const target = Math.round(Math.max(L.minTo, Math.min(L.maxTo, to)));
    // Close to all-in: just shove rather than leave a sliver behind.
    if (target >= L.maxTo * 0.85) return { type: "raise", to: L.maxTo };
    return { type: "raise", to: target };
  };
  const passive = (): Action => (L.canCheck ? { type: "check" } : { type: "fold" });
  const call = (): Action => (L.canCheck ? { type: "check" } : { type: "call" });

  /* ---------------- preflop ---------------- */
  if (g.street === "preflop") {
    const s = preflopStrength(p.hole) + mood * 0.5;
    const raisesBefore = g.raisesThisStreet;

    // Short stacks play push-or-fold.
    if (stackBb <= 12) {
      const shoveAt = 0.62 - me.looseness * 0.2 - pos * 0.08 - (raisesBefore === 0 ? 0.06 : 0);
      if (s >= shoveAt && L.canRaise) return { type: "raise", to: L.maxTo };
      if (s >= shoveAt - 0.04 || (L.canCheck && rand() < 0.9)) return call();
      return passive();
    }

    const openAt = 0.5 - me.looseness * 0.32 - pos * 0.12;
    if (raisesBefore === 0) {
      // Unopened (or limped) pot.
      const limpers = g.players.filter((q) => q.id !== seat && q.voluntary && inHand(q)).length;
      const stealing = pos > 0.7 && rand() < me.bluff * 0.35;
      // Passive players limp in with hands an aggressive player would raise.
      const raises = rand() < 0.3 + me.aggression * 0.7 || s >= openAt + 0.25;
      if (L.canRaise && ((s >= openAt && raises) || stealing)) {
        const size = bb * (2 + rand() * 1.4 + limpers);
        return raiseTo(size);
      }
      if (s >= openAt && !L.canCheck) return call();
      if (L.canCheck) return { type: "check" };
      if (s >= openAt - 0.08 && rand() < me.looseness * 0.6 + me.stickiness * 0.2) return call();
      return passive();
    }

    // Facing a raise (or more).
    const bigBlindDefence = seat === g.bbSeat && raisesBefore === 1 ? 0.07 : 0;
    const need = openAt + 0.08 + 0.08 * (raisesBefore - 1) - me.stickiness * 0.06 - bigBlindDefence;
    const potOdds = L.toCall / (pot + L.toCall);
    const cheap = potOdds < 0.2 && s >= need - 0.12;
    if (L.canRaise && (s >= need + 0.16 || (rand() < me.bluff * 0.07 && pos > 0.5))) {
      if (stackBb < 25 || raisesBefore >= 3) return { type: "raise", to: L.maxTo };
      return raiseTo(g.currentBet * (2.6 + rand() * 0.9) + (pot - g.currentBet) * 0.25);
    }
    if (s >= need || cheap) return call();
    return passive();
  }

  /* ---------------- postflop ---------------- */
  const sims = opponents >= 4 ? 220 : 320;
  const e = clamp01(equity(g, seat, model, sims, rand) + mood);
  // Strength relative to a fair share: 1 is average in a multiway pot.
  const rel = e * (opponents + 1);
  const potOdds = L.toCall / (pot + L.toCall);
  const wasAggressor = g.preflopAggressor === seat;
  const river = g.street === "river";
  // Bots bluff a human who folds a lot more often, and bluff less into one who calls everything.
  const humanFolds = humanInHand && model.betsFaced >= 5 ? (model.foldsToBet + 1) / (model.betsFaced + 2) : 0.45;
  const bluffBoost = (humanFolds - 0.45) * 0.6;
  const sizing = (lo: number, hi: number) => pot * (lo + rand() * (hi - lo));
  const capReached = g.raisesThisStreet >= 3;

  const monster = e > 0.82 || rel > 2.6;
  const strong = e > 0.66 || rel > 2;
  const medium = e > 0.45 || rel > 1.3;

  if (L.canCheck) {
    if (!L.canRaise) return { type: "check" };
    if (monster) {
      if (rand() < me.trapping * 0.4 && !river) return { type: "check" }; // slow-play
      return raiseTo(rand() < me.aggression * 0.2 ? sizing(1.1, 1.5) : sizing(0.55, 1.0));
    }
    if (strong && rand() < 0.45 + me.aggression * 0.45) return raiseTo(sizing(0.4, 0.85));
    if (medium && rand() < me.aggression * 0.3) return raiseTo(sizing(0.3, 0.6));
    // Bluffs and continuation bets.
    const cbet = wasAggressor && g.street === "flop" ? 0.35 : 0;
    const bluffChance = me.bluff * (0.25 + cbet + bluffBoost) * (opponents > 2 ? 0.4 : 1);
    if (rand() < bluffChance) return raiseTo(sizing(0.35, 0.8));
    return { type: "check" };
  }

  // Facing a bet.
  const callMargin = 0.04 - me.stickiness * 0.09 - (river ? 0 : 0.03);
  if (monster) {
    if (L.canRaise && !capReached && rand() < 0.35 + me.aggression * 0.45 - me.trapping * 0.2) {
      const spr = p.stack / Math.max(1, pot);
      if (spr < 1.5) return { type: "raise", to: L.maxTo };
      return raiseTo(g.currentBet * (2.4 + rand() * 1.1) + pot * 0.2);
    }
    if (capReached && L.canRaise && e > 0.88) return { type: "raise", to: L.maxTo };
    return call();
  }
  if (e >= potOdds + callMargin) {
    // Semi-bluff raises with drawing hands before the river.
    if (L.canRaise && !capReached && !river && strong && rand() < me.aggression * 0.25) return raiseTo(g.currentBet * (2.5 + rand()));
    return call();
  }
  if (L.canRaise && !capReached && rand() < me.bluff * (0.05 + bluffBoost * 0.5) && opponents === 1) {
    return raiseTo(g.currentBet * (2.6 + rand() * 0.8));
  }
  // Tiny bets relative to the pot get called with almost anything.
  if (potOdds < 0.12 && e > 0.15) return call();
  return passive();
}

/** A natural-looking thinking delay, longer for big decisions. */
export function thinkingMs(g: Game, seat: number, fast: boolean): number {
  const L = legal(g, seat);
  const big = L.toCall > g.bb * 10;
  const base = fast ? 350 : 750;
  return base + Math.random() * (fast ? 500 : 1100) + (big ? (fast ? 300 : 900) : 0);
}

