/* ------------------------------------------------------------------ */
/*  Market of Cards — group market-making game (pure logic).           */
/*                                                                     */
/*  4 players (you + 3 AI). Each is dealt 2 cards face-down; 3 cards    */
/*  sit face-down on the table → 11 cards in play. Players quote a      */
/*  two-way market on the SUM of all 11 cards. Table cards are turned   */
/*  over one per round; at settlement the true sum is revealed.         */
/*                                                                     */
/*  Card values: A–10 are worth face × 10 (Ace low → 10 … 10 → 100).   */
/*  Face cards are ±(rank×10): red positive, black negative, so they    */
/*  net to zero. The whole deck sums to exactly 2200 (mean 42.31).      */
/* ------------------------------------------------------------------ */

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
  faceUp: boolean;
}

export const DECK_SUM = 2200;
export const DECK_SIZE = 52;
export const CARDS_IN_PLAY = 11;
export const QUICK_EV = 42.31; // 2200 / 52, rounded
export const TABLE_MID = Math.round(CARDS_IN_PLAY * QUICK_EV); // 465

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_INDEX: Record<Rank, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

export function isRed(suit: Suit) {
  return suit === "♥" || suit === "♦";
}

/** Scoring value: A–10 = rank×10; J/Q/K = ±rank×10 (red +, black −). */
export function cardValue(card: Card): number {
  const base = RANK_INDEX[card.rank] * 10;
  const isFace = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  if (isFace) return isRed(card.suit) ? base : -base;
  return base;
}

/** Pip count used purely for rendering (A→14 court-ace, 2–10→that many pips). */
export function pipValue(rank: Rank): number {
  return rank === "A" ? 14 : RANK_INDEX[rank];
}

export function sumValue(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS) deck.push({ rank, suit, faceUp: false });
  return deck;
}

export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --------------------------------- EV ----------------------------------- */

/** Exact expected value of one unknown card given what you've seen. */
export function exactPerCard(knownSum: number, knownCount: number): number {
  return (DECK_SUM - knownSum) / (DECK_SIZE - knownCount);
}

/** Exact EV of the 11-card total given your known cards. */
export function exactTotalEV(knownSum: number, knownCount: number): number {
  return knownSum + (CARDS_IN_PLAY - knownCount) * exactPerCard(knownSum, knownCount);
}

/** Quick (static) EV of the 11-card total — treats every unknown as 42.31. */
export function quickTotalEV(knownSum: number, knownCount: number): number {
  return knownSum + (CARDS_IN_PLAY - knownCount) * QUICK_EV;
}

/* --------------------------------- AI ----------------------------------- */

export interface Quote {
  bid: number;
  ask: number;
}

/**
 * An AI quotes around a blend of its own exact EV and the table mid (so it
 * doesn't fully reveal its hand), nudged by how aggressive the human has been.
 */
export function aiQuote(
  known: Card[], // the AI's 2 cards + revealed table cards
  opts: { blend: number; spread: number; humanBias: number },
): Quote {
  const ev = exactTotalEV(sumValue(known), known.length);
  const mid = Math.round(opts.blend * ev + (1 - opts.blend) * TABLE_MID + opts.humanBias);
  const half = Math.round(opts.spread / 2);
  return { bid: mid - half, ask: mid + half };
}

/** The fair value an AI uses to decide whether to pick off your market. */
export function aiFair(known: Card[]): number {
  return exactTotalEV(sumValue(known), known.length);
}
