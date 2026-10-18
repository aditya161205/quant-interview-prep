import { RANK_NAMES, RANK_PLURALS, rankOf, suitOf, type Card } from "./cards";

/**
 * Scores the best five-card hand among 5–7 cards. Higher is better; equal scores tie.
 * Layout: category << 20, then up to five ranks of 4 bits each, most significant first.
 */
export const CATEGORIES = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;

const encode = (cat: number, ranks: number[]) => {
  let s = cat;
  for (let i = 0; i < 5; i++) s = (s << 4) | (ranks[i] ?? 0);
  return s;
};

/** Highest rank of a five-in-a-row run in a rank bitmask (ace plays low in A-2-3-4-5), or -1. */
function topStraight(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    const run = 0b11111 << (hi - 4);
    if ((mask & run) === run) return hi;
  }
  // The wheel: A,2,3,4,5 is a five-high straight.
  const wheel = (1 << 12) | 0b1111;
  return (mask & wheel) === wheel ? 3 : -1;
}

/** Ranks present in a mask, highest first. */
function ranksDesc(mask: number, take = 5, except: number[] = []): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < take; r--) if (mask & (1 << r) && !except.includes(r)) out.push(r);
  return out;
}

export function evaluate(cards: Card[]): number {
  const counts = new Array(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    mask |= 1 << r;
  }

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = topStraight(suitMasks[flushSuit]);
    if (sf >= 0) return encode(8, [sf]);
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
  }

  if (quads.length) return encode(7, [quads[0], ...ranksDesc(mask, 1, [quads[0]])]);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return encode(6, [trips[0], pairRank]);
  }
  if (flushSuit >= 0) return encode(5, ranksDesc(suitMasks[flushSuit]));
  const st = topStraight(mask);
  if (st >= 0) return encode(4, [st]);
  if (trips.length) return encode(3, [trips[0], ...ranksDesc(mask, 2, [trips[0]])]);
  if (pairs.length >= 2) return encode(2, [pairs[0], pairs[1], ...ranksDesc(mask, 1, [pairs[0], pairs[1]])]);
  if (pairs.length) return encode(1, [pairs[0], ...ranksDesc(mask, 3, [pairs[0]])]);
  return encode(0, ranksDesc(mask));
}

export const categoryOf = (score: number) => score >> 20;
const rankAt = (score: number, i: number) => (score >> (16 - 4 * i)) & 15;

/** "Two pair, Kings and Sevens", "Flush, Ace high", "Straight, Five high"… */
export function describe(score: number): string {
  const cat = categoryOf(score);
  const r0 = rankAt(score, 0);
  const r1 = rankAt(score, 1);
  switch (cat) {
    case 8:
      return r0 === 12 ? "Royal flush" : `Straight flush, ${RANK_NAMES[r0]} high`;
    case 7:
      return `Four of a kind, ${RANK_PLURALS[r0]}`;
    case 6:
      return `Full house, ${RANK_PLURALS[r0]} full of ${RANK_PLURALS[r1]}`;
    case 5:
      return `Flush, ${RANK_NAMES[r0]} high`;
    case 4:
      return `Straight, ${RANK_NAMES[r0]} high`;
    case 3:
      return `Three of a kind, ${RANK_PLURALS[r0]}`;
    case 2:
      return `Two pair, ${RANK_PLURALS[r0]} and ${RANK_PLURALS[r1]}`;
    case 1:
      return `Pair of ${RANK_PLURALS[r0]}`;
    default:
      return `${RANK_NAMES[r0]} high`;
  }
}

/** The five cards that make the score, for highlighting at showdown. */
export function bestFive(cards: Card[]): Card[] {
  if (cards.length <= 5) return cards;
  const target = evaluate(cards);
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            if (evaluate(five) === target) return five;
          }
  return cards.slice(0, 5);
}
