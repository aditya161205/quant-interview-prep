/** Trader-badge codes: the Pit design labels companies, games and paths with them instead of icons. */

const COMPANY_CODES: Record<string, string> = {
  "jane street": "JST",
  citadel: "CIT",
  drw: "DRW",
  "top firm": "TOP",
  "susquehanna international group": "SIG",
  "akuna capital": "AKU",
  graviton: "GRV",
  "jump trading": "JMP",
  "imc trading": "IMC",
  optiver: "OPT",
  "hudson river trading": "HRT",
  "five rings": "FVR",
  "two sigma": "TWO",
};

export function companyCode(name: string): string {
  return COMPANY_CODES[name.trim().toLowerCase()] ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

export const GAMES = [
  { href: "/market-making/card-game", code: "CTG", title: "Card Trading Game", kind: "Market making", blurb: "A rotating market maker quotes two-sided markets on a hidden hand. Trade against it, or quote your own." },
  { href: "/market-making/etf-arbitrage", code: "ETF", title: "ETF Arbitrage", kind: "Market taking", blurb: "Price an ETF from its basket, spot mispricings against the bid and ask, and race three AI traders." },
  { href: "/market-making/probability-betting", code: "PBT", title: "Probability Betting", kind: "Probability · Kelly", blurb: "Price dice, card and coin events, take the odds the house has mispriced, and size with Kelly." },
  { href: "/market-making/market-of-cards", code: "MOC", title: "Market of Cards", kind: "Group making", blurb: "Quote two-way markets on the total of 11 cards and trade three AI agents as the table reveals." },
  { href: "/market-making/arrow-game", code: "ARW", title: "Arrow Game", kind: "Focus · Reaction", blurb: "React to the middle arrow, ignore the flankers, hold back on no-go rounds: focus, speed and impulse control." },
  { href: "/market-making/tournament", code: "TRN", title: "Tournament Market", kind: "Probability · Estimation", blurb: "Price outcomes of a four-team tournament from a win-probability matrix, then re-price as results drop." },
  { href: "/market-making/figgie", code: "FIG", title: "Figgie", kind: "Jane Street's card game", blurb: "Trade suits in real time against bots, work out which suit is the goal from the flow, and hold the most of it." },
] as const;

/** The first two games are free; the rest need Pro (enforced on each game page). */
export const FREE_GAMES = 2;

/** Each path wears its own jacket inside the blue Paths section. */
export const TRACK_JACKET: Record<string, { color: string; code: string }> = {
  trader: { color: "#1d3fbf", code: "QT" },
  researcher: { color: "#5b2bb8", code: "QR" },
};
