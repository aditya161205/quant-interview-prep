/* ------------------------------------------------------------------ */
/*  ETF Arbitrage game — pure logic (no React).                        */
/*                                                                     */
/*  Each round you see a basket of stocks (ticker, price, weight, and  */
/*  weight×price). The ETF's fair value is the NAV = Σ(weight × price). */
/*  The market quotes the ETF with a bid/ask that may be mispriced:    */
/*    - NAV > ask  → ETF is cheap   → BUY at ask                       */
/*    - NAV < bid  → ETF is rich    → SELL at bid                      */
/*    - otherwise  → edge too small → SKIP                             */
/*  You race 3 AI traders; the fastest correct trader earns a bonus.   */
/* ------------------------------------------------------------------ */

export const TX_COST = 10;
export const FIRST_BONUS = 0.2; // +20% of net profit for the first trader

export const ROUND_OPTIONS = [4, 6, 8] as const;
export const MAX_UNITS_OPTIONS = [10, 20, 30] as const;
export const SECONDS_OPTIONS = [20, 30, 45] as const;

export type EtfAction = "buy" | "sell" | "skip";

export interface Stock {
  ticker: string;
  weight: number;
  price: number;
  change: number; // change vs the previous round
}

interface BasketDef {
  name: string;
  stocks: { ticker: string; weight: number; price: number }[];
}

export const BASKETS: BasketDef[] = [
  {
    name: "Tech basket",
    stocks: [
      { ticker: "AAPL", weight: 0.25, price: 200 },
      { ticker: "MSFT", weight: 0.25, price: 400 },
      { ticker: "GOOGL", weight: 0.25, price: 150 },
      { ticker: "AMZN", weight: 0.25, price: 200 },
    ],
  },
  {
    name: "Health basket",
    stocks: [
      { ticker: "JNJ", weight: 0.2, price: 157 },
      { ticker: "UNH", weight: 0.2, price: 500 },
      { ticker: "PFE", weight: 0.4, price: 27 },
      { ticker: "ABT", weight: 0.2, price: 114 },
    ],
  },
  {
    name: "Retail basket",
    stocks: [
      { ticker: "WMT", weight: 0.3, price: 177 },
      { ticker: "COST", weight: 0.2, price: 777 },
      { ticker: "HD", weight: 0.2, price: 360 },
      { ticker: "TGT", weight: 0.3, price: 147 },
    ],
  },
  {
    name: "Energy basket",
    stocks: [
      { ticker: "XOM", weight: 0.3, price: 110 },
      { ticker: "CVX", weight: 0.3, price: 160 },
      { ticker: "COP", weight: 0.2, price: 110 },
      { ticker: "SLB", weight: 0.2, price: 45 },
    ],
  },
  {
    name: "Finance basket",
    stocks: [
      { ticker: "JPM", weight: 0.3, price: 200 },
      { ticker: "BAC", weight: 0.3, price: 40 },
      { ticker: "WFC", weight: 0.2, price: 60 },
      { ticker: "GS", weight: 0.2, price: 450 },
    ],
  },
];

export const BOT_NAMES = ["Riley", "Alex", "Rowan", "Logan", "Casey", "Morgan", "Jordan"];

const EVENTS = [
  "Sector rallies on strong earnings",
  "Rate-cut hopes lift the basket",
  "Profit-taking drags the sector lower",
  "Analyst upgrades spark a rally",
  "Supply-chain fears hit the group",
  "Retail sales surge on back-to-school demand",
  "Regulatory headlines weigh on the sector",
  "Buyback announcements boost sentiment",
];

export interface EtfRound {
  basket: string;
  stocks: Stock[];
  nav: number;
  etfBid: number;
  etfAsk: number;
  event: string | null;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** crude ~N(0,1) */
const gauss = () => Math.random() + Math.random() + Math.random() - 1.5;

function navOf(stocks: Stock[]): number {
  return r2(stocks.reduce((s, x) => s + x.weight * x.price, 0));
}

function quoteEtf(nav: number): { etfBid: number; etfAsk: number } {
  const efficient = Math.random() < 0.3;
  const misPct = efficient
    ? (Math.random() - 0.5) * 0.001
    : (Math.random() < 0.5 ? -1 : 1) * (0.005 + Math.random() * 0.03);
  const mid = nav * (1 + misPct);
  const spread = Math.max(0.1, nav * 0.0008);
  return { etfBid: r2(mid - spread / 2), etfAsk: r2(mid + spread / 2) };
}

export function dealFirstRound(): EtfRound {
  const def = BASKETS[Math.floor(Math.random() * BASKETS.length)];
  const stocks: Stock[] = def.stocks.map((s) => ({ ...s, change: 0 }));
  const nav = navOf(stocks);
  return { basket: def.name, stocks, nav, ...quoteEtf(nav), event: null };
}

export function nextEtfRound(prev: EtfRound): EtfRound {
  const event = Math.random() < 0.3 ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : null;
  const drift = event ? (Math.random() < 0.5 ? -1 : 1) * (0.02 + Math.random() * 0.04) : 0;
  const stocks: Stock[] = prev.stocks.map((s) => {
    const pct = drift + (Math.random() - 0.5) * 0.03;
    const price = Math.max(1, r2(s.price * (1 + pct)));
    return { ...s, price, change: r2(price - s.price) };
  });
  const nav = navOf(stocks);
  return { basket: prev.basket, stocks, nav, ...quoteEtf(nav), event };
}

/** The best decision for a round, used to grade "correct trades". */
export function optimalAction(round: EtfRound): EtfAction {
  if (round.nav > round.etfAsk) return "buy";
  if (round.nav < round.etfBid) return "sell";
  return "skip";
}

export function etfPnl(
  action: EtfAction,
  units: number,
  round: EtfRound,
  isFirst: boolean,
): number {
  if (action === "skip") return 0;
  const edge = action === "buy" ? round.nav - round.etfAsk : round.etfBid - round.nav;
  const afterCost = edge * units - TX_COST;
  const bonus = isFirst && afterCost > 0 ? afterCost * FIRST_BONUS : 0;
  return r2(afterCost + bonus);
}

export interface BotPlan {
  name: string;
  action: EtfAction;
  units: number;
  speed: number; // seconds taken to act
}

/** An AI trader's intended action for a round (computed at round start). */
export function makeBotPlan(name: string, round: EtfRound, maxUnits: number): BotPlan {
  const sigma = 0.003 + Math.random() * 0.004;
  const navEst = round.nav * (1 + gauss() * sigma);
  const mid = (round.etfBid + round.etfAsk) / 2;
  const edge = navEst - mid;
  const minEdge = round.nav * 0.003;
  const sizeOf = (e: number) => clamp(Math.round(Math.abs(e) / (round.nav * 0.0015)), 1, maxUnits);

  let action: EtfAction = "skip";
  let units = 0;
  if (edge > minEdge) {
    action = "buy";
    units = sizeOf(edge);
  } else if (edge < -minEdge) {
    action = "sell";
    units = sizeOf(edge);
  }
  return { name, action, units, speed: r2(1.5 + Math.random() * 5) };
}
