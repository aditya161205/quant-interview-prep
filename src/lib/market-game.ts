/* ------------------------------------------------------------------ */
/*  Market-Making card game — pure logic (no React).                   */
/*                                                                     */
/*  Inspired by the TraderMath card trading game:                      */
/*  4 players sit at a table and the role of MARKET MAKER rotates each  */
/*  round. The instrument is the SUM of a small set of cards, some of  */
/*  which are face-up and some face-down.                              */
/*                                                                     */
/*   • When YOU are the market maker, you quote a two-sided bid/ask    */
/*     and informed flow trades against you if it is mispriced.        */
/*   • When a BOT is the market maker, it posts a bid/ask and you      */
/*     decide to BUY (at ask), SELL (at bid), or SKIP.                 */
/*                                                                     */
/*  Everything settles at the realized sum once all cards flip up.     */
/* ------------------------------------------------------------------ */

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
  value: number; // 2..10 face, J=11, Q=12, K=13, Ace high = 14
  faceUp: boolean;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
// Value convention (matches the in-game reference): 2–10 face value,
// J=11, Q=12, K=13, Ace high = 14.
const RANKS: { rank: Rank; value: number }[] = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 11 },
  { rank: "Q", value: 12 },
  { rank: "K", value: 13 },
  { rank: "A", value: 14 },
];

export const DECK_TOTAL = 416; // sum of all 52 card values (mean 8 per card)
export const DECK_SIZE = 52;
export const NUM_CARDS = 3; // default cards in the instrument
export const MIN_SPREAD = 1;
export const MAX_SPREAD = 6;

export interface GameConfig {
  numCards: number;
  totalRounds: number;
  makeSeconds: number; // time to quote a market when you are the maker
  tradeSeconds: number; // time to buy/sell/skip against a bot's quote
}

export const DEFAULT_CONFIG: GameConfig = {
  numCards: 3,
  totalRounds: 8,
  makeSeconds: 15,
  tradeSeconds: 20,
};

export const CONFIG_OPTIONS = {
  numCards: [2, 3, 4, 5],
  totalRounds: [4, 8, 12],
  makeSeconds: [10, 15, 20],
  tradeSeconds: [15, 20, 30],
} as const;

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const { rank, value } of RANKS) {
      deck.push({ rank, suit, value, faceUp: false });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface Hand {
  cards: Card[];       // NUM_CARDS cards; some faceUp, some not
  revealedSum: number; // sum of currently face-up cards
  trueSum: number;     // realized settlement value (all cards)
  ev: number;          // expected total given the face-up cards
}

/**
 * Deal a hand of `numCards`, revealing a random number of them: anywhere from
 * 0 (fully hidden — pure EV play) up to numCards-1 (settlement only happens
 * after you trade). Which specific cards are face-up is randomised too.
 */
export function dealHand(numCards: number = NUM_CARDS): Hand {
  const drawn = shuffle(buildDeck()).slice(0, numCards);
  const numRevealed = Math.floor(Math.random() * numCards); // 0 .. numCards-1
  const upSet = new Set(
    shuffle([...Array(numCards).keys()]).slice(0, numRevealed),
  );

  const cards = drawn.map((c, i) => ({ ...c, faceUp: upSet.has(i) }));
  const revealedSum = cards
    .filter((c) => c.faceUp)
    .reduce((s, c) => s + c.value, 0);
  const trueSum = cards.reduce((s, c) => s + c.value, 0);

  const hiddenCount = numCards - numRevealed;
  // Each hidden card's expectation = mean of the deck minus the revealed cards.
  const meanRemaining = (DECK_TOTAL - revealedSum) / (DECK_SIZE - numRevealed);
  const ev = revealedSum + hiddenCount * meanRemaining;

  return { cards, revealedSum, trueSum, ev };
}

export interface Quote {
  bid: number;
  ask: number;
}

/**
 * A bot market maker quotes around fair value (EV) with a small, slightly
 * noisy spread that respects the min/max spread rules. Occasionally it is a
 * touch off-center — which is the edge you are hunting for as a trader.
 */
export function botQuote(ev: number): Quote {
  const spread =
    MIN_SPREAD +
    Math.floor(Math.random() * (MAX_SPREAD - MIN_SPREAD + 1));
  const skew = Math.round((Math.random() - 0.5) * 3); // -1..+1 ish mispricing
  const mid = Math.round(ev) + skew;
  const bid = mid - Math.ceil(spread / 2);
  const ask = bid + spread;
  return { bid: Math.max(0, bid), ask: Math.max(spread, ask) };
}

/* ------------------------------- scoring -------------------------------- */

const FLOW_CONST = MAX_SPREAD + 1; // tighter correct markets earn more flow

/**
 * Your PnL when YOU are the market maker, settling at trueSum:
 *   - trueSum > ask → informed flow lifts your offer; you're short too cheap.
 *   - trueSum < bid → informed flow hits your bid; you're long too dear.
 *   - bid ≤ trueSum ≤ ask → you bracketed fair value and capture spread on
 *     uninformed flow. Capture rewards TIGHT markets: (FLOW_CONST − spread).
 */
export function makerPnl(quote: Quote, trueSum: number): number {
  const { bid, ask } = quote;
  const spread = ask - bid;
  if (trueSum > ask) return ask - trueSum;
  if (trueSum < bid) return bid - trueSum;
  return Math.max(0, FLOW_CONST - spread);
}

export type TradeAction = "buy" | "sell" | "skip";

/** Your PnL as a trader hitting a bot's quote, for `qty` units. */
export function traderPnl(
  action: TradeAction,
  quote: Quote,
  trueSum: number,
  qty: number,
): number {
  if (action === "buy") return (trueSum - quote.ask) * qty; // bought at ask
  if (action === "sell") return (quote.bid - trueSum) * qty; // sold at bid
  return 0;
}

/**
 * Worst-case exposure of a trade, so a player can never commit more than their
 * balance. A buy costs `qty * ask` up front; a short's max loss is the gap up
 * to the largest possible settlement (every card an Ace = 14).
 */
export function maxTradeExposure(
  action: TradeAction,
  quote: Quote,
  qty: number,
  numCards: number,
): number {
  if (action === "buy") return qty * quote.ask;
  if (action === "sell") return qty * (numCards * 14 - quote.bid);
  return 0;
}

export function canAfford(
  action: TradeAction,
  quote: Quote,
  qty: number,
  numCards: number,
  balance: number,
): boolean {
  return maxTradeExposure(action, quote, qty, numCards) <= balance;
}

export interface BotTrade {
  player: number; // index into the players array
  action: TradeAction;
  qty: number;
  price: number; // ask for a buy, bid for a sell, 0 for a skip
  makerDelta: number; // the maker's PnL from this trade (the bot's is the negative)
}

/**
 * Simulate how the bot traders react to YOUR market and settle the round.
 *   - trueSum > ask → informed bots lift your offer (buy at ask): you're short.
 *   - trueSum < bid → informed bots hit your bid (sell at bid): you're long.
 *   - bid ≤ trueSum ≤ ask → no edge; bots only do small noise flow you collect
 *     the spread on (rewards a tight, well-centred market).
 */
export function simulateMakerFlow(
  quote: Quote,
  trueSum: number,
  traderIndices: number[],
): { trades: BotTrade[]; makerPnl: number } {
  const { bid, ask } = quote;
  const trades: BotTrade[] = [];
  let makerPnl = 0;

  for (const player of traderIndices) {
    let trade: BotTrade;
    if (trueSum > ask) {
      const qty = Math.min(3, 1 + Math.floor((trueSum - ask) / 3));
      trade = { player, action: "buy", qty, price: ask, makerDelta: (ask - trueSum) * qty };
    } else if (trueSum < bid) {
      const qty = Math.min(3, 1 + Math.floor((bid - trueSum) / 3));
      trade = { player, action: "sell", qty, price: bid, makerDelta: (trueSum - bid) * qty };
    } else if (Math.random() < 0.6) {
      // bracketed → uninformed noise flow you profit from
      if (Math.random() < 0.5) {
        trade = { player, action: "buy", qty: 1, price: ask, makerDelta: ask - trueSum };
      } else {
        trade = { player, action: "sell", qty: 1, price: bid, makerDelta: trueSum - bid };
      }
    } else {
      trade = { player, action: "skip", qty: 0, price: 0, makerDelta: 0 };
    }
    makerPnl += trade.makerDelta;
    trades.push(trade);
  }

  return { trades, makerPnl };
}
