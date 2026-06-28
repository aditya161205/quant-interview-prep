/* ------------------------------------------------------------------ */
/*  Probability Betting Game — pure logic.                             */
/*                                                                     */
/*  Each round generates three independent events (two dice, two cards,*/
/*  three coins). The house quotes fractional odds that deviate from   */
/*  the true probability — your job is to compute the true odds, spot  */
/*  the mispriced (favourable) bets, and size them with Kelly.         */
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

function isRed(s: Suit) {
  return s === "♥" || s === "♦";
}
function isEven(n: number) {
  return n % 2 === 0;
}
function heads(o: RoundOutcome) {
  return o.coins.filter((c) => c === "H").length;
}

/* ------------------------------- outcomes ------------------------------- */

function d6() {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollOutcome(): RoundOutcome {
  const deck: OutcomeCard[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS) deck.push({ rank, suit, value: RANK_VALUE[rank] });
  // Fisher–Yates the first two slots
  for (let i = 0; i < 2; i++) {
    const j = i + Math.floor(Math.random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    dice: [d6(), d6()],
    cards: [deck[0], deck[1]],
    coins: Array.from({ length: 3 }, () => (Math.random() < 0.5 ? "H" : "T")),
  };
}

/* ----------------------------- propositions ----------------------------- */

export const PROPOSITIONS: Proposition[] = [
  // Dice
  { id: "d_sum7", category: "Dice", label: "Sum of the dice is exactly 7", trueProb: 6 / 36, evaluate: (o) => o.dice[0] + o.dice[1] === 7 },
  { id: "d_prod20", category: "Dice", label: "Product of the dice is greater than 20", trueProb: 6 / 36, evaluate: (o) => o.dice[0] * o.dice[1] > 20 },
  { id: "d_even", category: "Dice", label: "Both dice show even numbers", trueProb: 9 / 36, evaluate: (o) => isEven(o.dice[0]) && isEven(o.dice[1]) },
  { id: "d_six", category: "Dice", label: "At least one die shows a 6", trueProb: 11 / 36, evaluate: (o) => o.dice.includes(6) },
  { id: "d_double", category: "Dice", label: "The dice are equal (doubles)", trueProb: 6 / 36, evaluate: (o) => o.dice[0] === o.dice[1] },
  { id: "d_gt9", category: "Dice", label: "Sum of the dice is greater than 9", trueProb: 6 / 36, evaluate: (o) => o.dice[0] + o.dice[1] > 9 },

  // Cards (two cards, no replacement)
  { id: "c_even", category: "Cards", label: "Both cards have even values", trueProb: (28 / 52) * (27 / 51), evaluate: (o) => isEven(o.cards[0].value) && isEven(o.cards[1].value) },
  { id: "c_suit", category: "Cards", label: "Both cards are the same suit", trueProb: 12 / 51, evaluate: (o) => o.cards[0].suit === o.cards[1].suit },
  { id: "c_color", category: "Cards", label: "Both cards are the same colour", trueProb: 25 / 51, evaluate: (o) => isRed(o.cards[0].suit) === isRed(o.cards[1].suit) },
  { id: "c_face", category: "Cards", label: "At least one card is a face card (J/Q/K)", trueProb: 1 - (40 / 52) * (39 / 51), evaluate: (o) => o.cards.some((c) => c.value >= 11 && c.value <= 13) },
  { id: "c_pair", category: "Cards", label: "The two cards are a pair (same rank)", trueProb: 3 / 51, evaluate: (o) => o.cards[0].rank === o.cards[1].rank },

  // Coins (three fair coins)
  { id: "k_one_tail", category: "Coins", label: "Exactly one coin shows tails", trueProb: 3 / 8, evaluate: (o) => o.coins.filter((c) => c === "T").length === 1 },
  { id: "k_even_heads", category: "Coins", label: "An even number of coins show heads (0 or 2)", trueProb: 4 / 8, evaluate: (o) => isEven(heads(o)) },
  { id: "k_all_same", category: "Coins", label: "All three coins show the same face", trueProb: 2 / 8, evaluate: (o) => o.coins.every((c) => c === o.coins[0]) },
  { id: "k_two_heads", category: "Coins", label: "At least two coins show heads", trueProb: 4 / 8, evaluate: (o) => heads(o) >= 2 },
];

/* -------------------------------- odds ---------------------------------- */

export interface Odds {
  b: number; // decimal net odds — win pays stake × b, shown as "b:1"
  implied: number; // implied probability = 1 / (b + 1)
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Quote fractional odds that deviate from the true probability either way. */
export function skewedOdds(trueProb: number): Odds {
  const factor = 0.8 + Math.random() * 0.4; // implied = true × (0.8 .. 1.2)
  const implied0 = clamp(trueProb * factor, 0.02, 0.95);
  const b = Math.max(0.1, Math.round(((1 - implied0) / implied0) * 100) / 100);
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
