import { secureRandom } from "./poker/cards";

/**
 * Sealed-bid, first-price, common-value auction. An item is worth the same V to everyone, drawn uniformly from a
 * known range. Each bidder sees a private estimate V + noise, noise uniform in ±E. Highest bid wins and pays its bid.
 *
 * The winner's curse: winning means your estimate was probably the highest, which on average overshoots V by
 * E(n−1)/(n+1). Bid your estimate and you lose money; the risk-neutral equilibrium shades to about estimate − E.
 */

export const LOW = 100;
export const HIGH = 500;

export const ITEMS = ["Oil lease", "Jar of coins", "Mining claim", "Spectrum licence", "Wine cellar", "Art lot", "Shipping contract", "Timber tract", "Patent portfolio", "Storage unit"];

export interface Bidder {
  name: string;
  human: boolean;
  /** How much of the noise band a bot shades off its estimate (0 = bids its estimate). */
  shade: number;
  style: string;
}

export interface Lot {
  item: string;
  value: number;
  noise: number;
  estimates: number[];
}

export interface Outcome {
  bids: (number | null)[];
  /** -1 when nobody bid. */
  winner: number;
  profit: number[];
}

const STYLES = [
  { style: "Naive", lo: 0, hi: 0.3 },
  { style: "Careful", lo: 0.45, hi: 0.75 },
  { style: "Sharp", lo: 0.85, hi: 1.1 },
];

export function makeBidders(names: string[], rand: () => number = Math.random): Bidder[] {
  return names.map((name, i) => {
    if (i === 0) return { name, human: true, shade: 0, style: "You" };
    // At least one naive bidder per table, so the curse shows up.
    const s = i === 1 ? STYLES[0] : STYLES[Math.floor(rand() * STYLES.length)];
    return { name, human: false, shade: s.lo + rand() * (s.hi - s.lo), style: s.style };
  });
}

export function drawLot(n: number, noise: number, rand: () => number = secureRandom): Lot {
  const value = LOW + Math.floor(rand() * (HIGH - LOW + 1));
  const estimates = Array.from({ length: n }, () => value + Math.round((rand() * 2 - 1) * noise));
  return { item: ITEMS[Math.floor(rand() * ITEMS.length)], value, noise, estimates };
}

/** Where V can be, given an estimate: both the noise band and the item range bound it. */
export const bounds = (est: number, noise: number) => ({ lo: Math.max(LOW, est - noise), hi: Math.min(HIGH, est + noise) });

/** A bot's sealed bid. */
export function botBid(b: Bidder, est: number, noise: number, rand: () => number = Math.random): number {
  const { lo, hi } = bounds(est, noise);
  const raw = est - b.shade * noise + (rand() - 0.5) * noise * 0.15;
  return Math.max(1, Math.round(Math.min(hi, Math.max(lo - noise * 0.2, raw))));
}

/** Expected value of the item given your estimate is the highest of n, away from the range edges. */
export const breakEven = (est: number, noise: number, n: number) => est - (noise * (n - 1)) / (n + 1);

export function resolve(lot: Lot, bids: (number | null)[], rand: () => number = Math.random): Outcome {
  const top = Math.max(-1, ...bids.map((b) => b ?? -1));
  const leaders = bids.flatMap((b, i) => (b !== null && b === top ? [i] : []));
  const winner = leaders.length ? leaders[Math.floor(rand() * leaders.length)] : -1;
  const profit = bids.map((_, i) => (i === winner ? lot.value - top : 0));
  return { bids, winner, profit };
}

/**
 * Bots learn between lots: a winner that overpaid shades harder next time, and bidders that keep losing get
 * hungrier. The room drifts toward break-even instead of one naive bidder taking every lot.
 */
export function adapt(bidders: Bidder[], o: Outcome, rand: () => number = Math.random): Bidder[] {
  return bidders.map((b, i) => {
    if (b.human || o.bids[i] === null) return b;
    let shade = b.shade;
    if (i === o.winner) shade += o.profit[i] < 0 ? 0.2 + rand() * 0.2 : 0;
    else shade -= 0.01 + rand() * 0.02;
    return { ...b, shade: Math.min(1.2, Math.max(0, shade)) };
  });
}
