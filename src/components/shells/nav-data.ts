/** Navigation shared by the restructured design candidates. */
export const SECTIONS = [
  { href: "/", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/paths", label: "Paths" },
  { href: "/market-making", label: "Market Making" },
  { href: "/profile", label: "Profile" },
  { href: "/pricing", label: "Pricing" },
];

export const GAMES = [
  { href: "/market-making/card-game", title: "Card Trading Game" },
  { href: "/market-making/etf-arbitrage", title: "ETF Arbitrage Game" },
  { href: "/market-making/probability-betting", title: "Probability Betting" },
  { href: "/market-making/market-of-cards", title: "Market of Cards" },
  { href: "/market-making/arrow-game", title: "Arrow Game" },
  { href: "/market-making/tournament", title: "Tournament Market" },
];

export const isActive = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
