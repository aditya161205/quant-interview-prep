/* ------------------------------------------------------------------ */
/*  Probability Betting Game — pure logic.                             */
/*                                                                     */
/*  Each round generates three independent events (two dice, two cards,*/
/*  three coins). Propositions are generated procedurally with random  */
/*  parameters, so the true odds change every round (nothing to        */
/*  memorise). The house quotes fractional odds that are an UNBIASED    */
/*  50/50 coin-flip between favourable and unfavourable.               */
/* ------------------------------------------------------------------ */

export type Category = "Dice" | "Cards" | "Coins";
export type Suit = "♠" | "♥" | "♦" | "♣";

export interface OutcomeCard {
  rank: string; // "2".."10","J","Q","K","A"
  suit: Suit;
  value: number; // 2..10, J=11, Q=12, K=13, A=14
}

export interface RoundOutcome {
  dice: [number, number];
  cards: [OutcomeCard, OutcomeCard];
  coins: ("H" | "T")[]; // length 3
}

export interface Proposition {
  id: string;
  category: Category;
  label: string;
  trueProb: number;
  evaluate: (o: RoundOutcome) => boolean;
}

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUE: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 11, Q: 12, K: 13, A: 14,
};
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

export const STARTING_BANKROLL = 1000;

const isRed = (s: Suit) => s === "♥" || s === "♦";
const isEven = (n: number) => n % 2 === 0;
const heads = (o: RoundOutcome) => o.coins.filter((c) => c === "H").length;
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fullDeck(): OutcomeCard[] {
  const deck: OutcomeCard[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit, value: RANK_VALUE[rank] });
  return deck;
}

/* ------------------------------- outcomes ------------------------------- */

const d6 = () => 1 + Math.floor(Math.random() * 6);

export function rollOutcome(): RoundOutcome {
  const deck = shuffle(fullDeck());
  return {
    dice: [d6(), d6()],
    cards: [deck[0], deck[1]],
    coins: Array.from({ length: 3 }, () => (Math.random() < 0.5 ? "H" : "T")),
  };
}

/* --------------------- exact probability via enumeration --------------- */

function diceProb(pred: (a: number, b: number) => boolean): number {
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (pred(a, b)) c++;
  return c / 36;
}

function coinProb(pred: (h: number) => boolean): number {
  // 3 fair coins: head-counts 0,1,2,3 occur 1,3,3,1 times of 8.
  const weights = [1, 3, 3, 1];
  let c = 0;
  for (let h = 0; h <= 3; h++) if (pred(h)) c += weights[h];
  return c / 8;
}

function cardProb(pred: (c1: OutcomeCard, c2: OutcomeCard) => boolean): number {
  const deck = fullDeck();
  let hit = 0;
  let total = 0;
  for (let i = 0; i < deck.length; i++)
    for (let j = i + 1; j < deck.length; j++) {
      total++;
      if (pred(deck[i], deck[j])) hit++;
    }
  return hit / total;
}

/* ----------------------- proposition generators ------------------------ */

const mk = (
  category: Category,
  label: string,
  evaluate: (o: RoundOutcome) => boolean,
  trueProb: number,
): Proposition => ({ id: "", category, label, trueProb, evaluate });

type Template = () => Proposition;

const DICE_TEMPLATES: Template[] = [
  () => {
    const n = randInt(4, 10);
    return mk("Dice", `Sum of the dice equals ${n}`, (o) => o.dice[0] + o.dice[1] === n, diceProb((a, b) => a + b === n));
  },
  () => {
    const n = randInt(5, 10);
    return mk("Dice", `Sum of the dice is greater than ${n}`, (o) => o.dice[0] + o.dice[1] > n, diceProb((a, b) => a + b > n));
  },
  () => {
    const n = randInt(4, 9);
    return mk("Dice", `Sum of the dice is less than ${n}`, (o) => o.dice[0] + o.dice[1] < n, diceProb((a, b) => a + b < n));
  },
  () => {
    const n = pick([10, 12, 15, 18, 20]);
    return mk("Dice", `Product of the dice is greater than ${n}`, (o) => o.dice[0] * o.dice[1] > n, diceProb((a, b) => a * b > n));
  },
  () => {
    const x = randInt(1, 6);
    return mk("Dice", `At least one die shows a ${x}`, (o) => o.dice.includes(x), diceProb((a, b) => a === x || b === x));
  },
  () => {
    const k = randInt(1, 5);
    return mk("Dice", `The dice differ by at least ${k}`, (o) => Math.abs(o.dice[0] - o.dice[1]) >= k, diceProb((a, b) => Math.abs(a - b) >= k));
  },
  () => mk("Dice", "Both dice show even numbers", (o) => isEven(o.dice[0]) && isEven(o.dice[1]), 9 / 36),
  () => mk("Dice", "The two dice are equal (doubles)", (o) => o.dice[0] === o.dice[1], 6 / 36),
];

const COIN_TEMPLATES: Template[] = [
  () => {
    const k = randInt(0, 3);
    return mk("Coins", `Exactly ${k} coin${k === 1 ? "" : "s"} show heads`, (o) => heads(o) === k, coinProb((h) => h === k));
  },
  () => {
    const k = randInt(1, 3);
    return mk("Coins", `At least ${k} coin${k === 1 ? "" : "s"} show heads`, (o) => heads(o) >= k, coinProb((h) => h >= k));
  },
  () => {
    const k = randInt(0, 2);
    return mk("Coins", `At most ${k} coin${k === 1 ? "" : "s"} show heads`, (o) => heads(o) <= k, coinProb((h) => h <= k));
  },
  () => {
    const k = randInt(0, 3);
    return mk("Coins", `Exactly ${k} coin${k === 1 ? "" : "s"} show tails`, (o) => 3 - heads(o) === k, coinProb((h) => 3 - h === k));
  },
  () => mk("Coins", "All three coins show the same face", (o) => heads(o) === 0 || heads(o) === 3, 2 / 8),
  () => mk("Coins", "An even number of coins show heads (0 or 2)", (o) => isEven(heads(o)), 4 / 8),
  () => mk("Coins", "More heads than tails", (o) => heads(o) >= 2, 4 / 8),
];

const CARD_TEMPLATES: Template[] = [
  () => mk("Cards", "Both cards are the same suit", (o) => o.cards[0].suit === o.cards[1].suit, cardProb((a, b) => a.suit === b.suit)),
  () => mk("Cards", "Both cards are the same colour", (o) => isRed(o.cards[0].suit) === isRed(o.cards[1].suit), cardProb((a, b) => isRed(a.suit) === isRed(b.suit))),
  () => mk("Cards", "The two cards are a pair (same rank)", (o) => o.cards[0].rank === o.cards[1].rank, cardProb((a, b) => a.rank === b.rank)),
  () => mk("Cards", "At least one card is a face card (J/Q/K)", (o) => o.cards.some((c) => c.value >= 11 && c.value <= 13), cardProb((a, b) => [a, b].some((c) => c.value >= 11 && c.value <= 13))),
  () => mk("Cards", "At least one card is an Ace", (o) => o.cards.some((c) => c.rank === "A"), cardProb((a, b) => a.rank === "A" || b.rank === "A")),
  () => mk("Cards", "Both cards have even values", (o) => isEven(o.cards[0].value) && isEven(o.cards[1].value), cardProb((a, b) => isEven(a.value) && isEven(b.value))),
  () => {
    const v = pick([6, 8, 9, 10, 11]);
    return mk("Cards", `Both cards are higher than ${v}`, (o) => o.cards[0].value > v && o.cards[1].value > v, cardProb((a, b) => a.value > v && b.value > v));
  },
  () => {
    const s = pick([12, 16, 18, 20, 22]);
    return mk("Cards", `The two card values sum to more than ${s}`, (o) => o.cards[0].value + o.cards[1].value > s, cardProb((a, b) => a.value + b.value > s));
  },
  () => mk("Cards", "One card is red and one is black", (o) => isRed(o.cards[0].suit) !== isRed(o.cards[1].suit), cardProb((a, b) => isRed(a.suit) !== isRed(b.suit))),
];

const TEMPLATES: Record<Category, Template[]> = {
  Dice: DICE_TEMPLATES,
  Coins: COIN_TEMPLATES,
  Cards: CARD_TEMPLATES,
};

/** Generate `count` distinct, randomly-parameterised propositions for a category. */
export function generateProps(category: Category, count: number): Proposition[] {
  return shuffle(TEMPLATES[category]).slice(0, count).map((t) => t());
}

/* -------------------------------- odds ---------------------------------- */

export interface Odds {
  b: number; // decimal net odds — win pays stake × b, shown as "b:1"
  implied: number; // implied probability = 1 / (b + 1)
}

/**
 * Quote fractional odds with an UNBIASED 50/50 split between favourable
 * (implied < true → your edge) and unfavourable, with a clear edge so the
 * 2-decimal rounding can never flip which side it lands on.
 */
export function skewedOdds(trueProb: number): Odds {
  const favourable = Math.random() < 0.5;
  const edge = 0.12 + Math.random() * 0.2; // 12%–32% relative shift
  const factor = favourable ? 1 - edge : 1 + edge;
  const targetImplied = clamp(trueProb * factor, 0.02, 0.97);
  const b = Math.max(0.1, Math.round(((1 - targetImplied) / targetImplied) * 100) / 100);
  return { b, implied: 1 / (b + 1) };
}

export function isFavourable(odds: Odds, trueProb: number) {
  return odds.implied < trueProb - 1e-9; // house underprices the event → your edge
}

/** Kelly fraction f* = (b·p − q) / b, clamped to [0, 1]. */
export function kellyFraction(b: number, trueProb: number) {
  const q = 1 - trueProb;
  return clamp((b * trueProb - q) / b, 0, 1);
}

/** PnL of a single resolved bet. */
export function betPnl(won: boolean, stake: number, b: number) {
  return won ? stake * b : -stake;
}
