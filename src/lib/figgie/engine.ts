import { secureRandom } from "../poker/cards";

/**
 * Figgie (Jane Street's trading card game), as pure functions.
 *
 * Deck: 40 cards — one suit has 12, one has 8, two have 10. The goal suit is the other suit of the same colour as
 * the 12-card suit, so it has 8 or 10 cards. Everyone antes into a $200 pot and gets an equal hand. Trading is
 * one card at a time: bids and offers per suit, a new order must improve on the best one, and any trade clears
 * every order on the board. At the end each goal-suit card pays $10 and the rest of the pot goes to whoever holds
 * the most goal-suit cards (split on a tie).
 */

export const SUITS = ["spades", "clubs", "hearts", "diamonds"] as const;
export type Suit = (typeof SUITS)[number];
export const SUIT_SYMBOL: Record<Suit, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
export const SUIT_RED: Record<Suit, boolean> = { spades: false, clubs: false, hearts: true, diamonds: true };
/** The other suit of the same colour. */
export const PARTNER: Record<Suit, Suit> = { spades: "clubs", clubs: "spades", hearts: "diamonds", diamonds: "hearts" };

export const STARTING_CASH = 350;
export const POT = 200;
export const GOAL_CARD_VALUE = 10;

export type Hand = Record<Suit, number>;
export const emptyHand = (): Hand => ({ spades: 0, clubs: 0, hearts: 0, diamonds: 0 });
export const handSize = (h: Hand) => SUITS.reduce((a, s) => a + h[s], 0);

/** One of the 12 possible decks: which suit has 12 cards and which has 8 (the others have 10). */
export interface Layout {
  twelve: Suit;
  eight: Suit;
}
export const counts = (l: Layout): Hand => {
  const c = { spades: 10, clubs: 10, hearts: 10, diamonds: 10 };
  c[l.twelve] = 12;
  c[l.eight] = 8;
  return c;
};
export const goalOf = (l: Layout): Suit => PARTNER[l.twelve];
export const ALL_LAYOUTS: Layout[] = SUITS.flatMap((twelve) => SUITS.filter((s) => s !== twelve).map((eight) => ({ twelve, eight })));

export interface Order {
  price: number;
  player: number;
}
export interface Quote {
  bid: Order | null;
  ask: Order | null;
}
export interface Trade {
  suit: Suit;
  price: number;
  buyer: number;
  seller: number;
  at: number;
}

export interface FPlayer {
  id: number;
  name: string;
  human: boolean;
  cash: number;
  hand: Hand;
  /** Hand as dealt, used by bots for inference. */
  dealt: Hand;
}

export interface RoundResult {
  goal: Suit;
  layout: Layout;
  goalCounts: number[];
  bonusWinners: number[];
  bonus: number;
  payout: number[];
  /** Profit this round: cash at the end minus cash before the ante. */
  net: number[];
}

export interface Figgie {
  players: FPlayer[];
  round: number;
  layout: Layout;
  book: Record<Suit, Quote>;
  trades: Trade[];
  pot: number;
  ante: number;
  phase: "trading" | "settled";
  result: RoundResult | null;
  /** Cash each player held before this round's ante. */
  startCash: number[];
}

const emptyBook = (): Record<Suit, Quote> => ({
  spades: { bid: null, ask: null },
  clubs: { bid: null, ask: null },
  hearts: { bid: null, ask: null },
  diamonds: { bid: null, ask: null },
});

export function newTable(names: string[]): FPlayer[] {
  return names.map((name, i) => ({ id: i, name, human: i === 0, cash: STARTING_CASH, hand: emptyHand(), dealt: emptyHand() }));
}

/** Shuffle a fresh deck with a random layout, collect the ante and deal equal hands. */
export function dealRound(players: FPlayer[], round: number, rand: () => number = secureRandom): Figgie {
  const layout = ALL_LAYOUTS[Math.floor(rand() * ALL_LAYOUTS.length)];
  const c = counts(layout);
  const deck: Suit[] = SUITS.flatMap((s) => Array<Suit>(c[s]).fill(s));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const n = players.length;
  const ante = POT / n;
  const per = 40 / n;
  const next = players.map((p, i) => {
    const hand = emptyHand();
    for (const s of deck.slice(i * per, (i + 1) * per)) hand[s]++;
    return { ...p, cash: p.cash - ante, hand, dealt: { ...hand } };
  });
  return {
    players: next,
    round,
    layout,
    book: emptyBook(),
    trades: [],
    pot: POT,
    ante,
    phase: "trading",
    result: null,
    startCash: players.map((p) => p.cash),
  };
}

/* ----------------------------------------------------------------- orders */

export type Rejection = string;

const copy = (g: Figgie): Figgie => ({
  ...g,
  players: g.players.map((p) => ({ ...p, hand: { ...p.hand } })),
  book: { spades: { ...g.book.spades }, clubs: { ...g.book.clubs }, hearts: { ...g.book.hearts }, diamonds: { ...g.book.diamonds } },
  trades: [...g.trades],
});

/** Post a bid. It must beat the current best bid, and you must be able to pay it. */
export function bid(g: Figgie, player: number, suit: Suit, price: number): Figgie | Rejection {
  if (g.phase !== "trading") return "Trading is closed.";
  price = Math.floor(price);
  const p = g.players[player];
  const q = g.book[suit];
  if (!(price >= 1)) return "Bids start at $1.";
  if (price > p.cash) return "You can't bid more than your cash.";
  if (q.bid && price <= q.bid.price) return `Beat the best bid of $${q.bid.price}.`;
  if (q.ask && price >= q.ask.price) {
    if (q.ask.player === player) return "That would cross your own offer.";
    return buy(g, player, suit); // a bid at or above the offer just trades at the offer
  }
  const n = copy(g);
  n.book[suit].bid = { price, player };
  return n;
}

/** Post an offer. It must beat the current best offer, and you must hold a card of the suit. */
export function offer(g: Figgie, player: number, suit: Suit, price: number): Figgie | Rejection {
  if (g.phase !== "trading") return "Trading is closed.";
  price = Math.ceil(price);
  const p = g.players[player];
  const q = g.book[suit];
  if (!(price >= 1)) return "Offers start at $1.";
  if (p.hand[suit] < 1) return `You have no ${suit} to sell.`;
  if (q.ask && price >= q.ask.price) return `Beat the best offer of $${q.ask.price}.`;
  if (q.bid && price <= q.bid.price) {
    if (q.bid.player === player) return "That would cross your own bid.";
    return sell(g, player, suit);
  }
  const n = copy(g);
  n.book[suit].ask = { price, player };
  return n;
}

/** Lift the best offer: buy one card at the offer price. */
export function buy(g: Figgie, player: number, suit: Suit): Figgie | Rejection {
  const q = g.book[suit];
  if (g.phase !== "trading") return "Trading is closed.";
  if (!q.ask) return "No offer to buy from.";
  if (q.ask.player === player) return "That's your own offer.";
  if (g.players[player].cash < q.ask.price) return "Not enough cash.";
  if (g.players[q.ask.player].hand[suit] < 1) return "The seller no longer has that card.";
  return execute(g, suit, q.ask.price, player, q.ask.player);
}

/** Hit the best bid: sell one card at the bid price. */
export function sell(g: Figgie, player: number, suit: Suit): Figgie | Rejection {
  const q = g.book[suit];
  if (g.phase !== "trading") return "Trading is closed.";
  if (!q.bid) return "No bid to sell into.";
  if (q.bid.player === player) return "That's your own bid.";
  if (g.players[player].hand[suit] < 1) return `You have no ${suit} to sell.`;
  if (g.players[q.bid.player].cash < q.bid.price) return "The buyer can no longer pay.";
  return execute(g, suit, q.bid.price, q.bid.player, player);
}

export function cancel(g: Figgie, player: number, suit: Suit, side: "bid" | "ask"): Figgie {
  if (g.book[suit][side]?.player !== player) return g;
  const n = copy(g);
  n.book[suit][side] = null;
  return n;
}

function execute(g: Figgie, suit: Suit, price: number, buyer: number, seller: number): Figgie {
  const n = copy(g);
  n.players[buyer].cash -= price;
  n.players[buyer].hand[suit] += 1;
  n.players[seller].cash += price;
  n.players[seller].hand[suit] -= 1;
  n.trades.push({ suit, price, buyer, seller, at: n.trades.length });
  // Every trade clears the whole board.
  n.book = emptyBook();
  return n;
}

/* ----------------------------------------------------------------- settle */

export function settle(g: Figgie): Figgie {
  if (g.phase !== "trading") return g;
  const n = copy(g);
  n.book = emptyBook();
  const goal = goalOf(n.layout);
  const goalCounts = n.players.map((p) => p.hand[goal]);
  const payout = goalCounts.map((c) => c * GOAL_CARD_VALUE);
  const bonus = n.pot - payout.reduce((a, b) => a + b, 0);
  const most = Math.max(...goalCounts);
  const bonusWinners = n.players.filter((p) => goalCounts[p.id] === most).map((p) => p.id);
  // Split the bonus; any odd dollars go to the earliest seats among the winners.
  const share = Math.floor(bonus / bonusWinners.length);
  let odd = bonus - share * bonusWinners.length;
  for (const w of bonusWinners) {
    payout[w] += share + (odd > 0 ? 1 : 0);
    if (odd > 0) odd--;
  }
  n.players.forEach((p, i) => (p.cash += payout[i]));
  n.pot = 0;
  n.phase = "settled";
  n.result = {
    goal,
    layout: n.layout,
    goalCounts,
    bonusWinners,
    bonus,
    payout,
    net: n.players.map((p, i) => p.cash - n.startCash[i]),
  };
  return n;
}
