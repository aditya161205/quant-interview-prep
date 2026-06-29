import { Spade, TrendingUp, Dices, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconCard, type CardColor } from "@/components/icon-card";

export const metadata = {
  title: "Market Making Games — QuantPrep",
};

const games: {
  href: string;
  title: string;
  kicker: string;
  description: string;
  icon: typeof Spade;
  color: CardColor;
  watermark: string;
}[] = [
  {
    href: "/market-making/card-game",
    title: "Card Trading Game",
    kicker: "Market making",
    description:
      "A rotating market maker quotes a two-sided market on a hidden hand; trade against it or quote your own.",
    icon: Spade,
    color: "violet",
    watermark: "CT",
  },
  {
    href: "/market-making/etf-arbitrage",
    title: "ETF Arbitrage Game",
    kicker: "Market taking",
    description:
      "Compute an ETF's NAV from its basket, spot mispricings against the bid/ask, and race 3 AI traders.",
    icon: TrendingUp,
    color: "emerald",
    watermark: "ETF",
  },
  {
    href: "/market-making/probability-betting",
    title: "Probability Betting",
    kicker: "Probability · Kelly",
    description:
      "Price dice, card and coin events, take the odds the house has mispriced in your favour, and size with Kelly.",
    icon: Dices,
    color: "amber",
    watermark: "PB",
  },
  {
    href: "/market-making/market-of-cards",
    title: "Market of Cards",
    kicker: "Group making",
    description:
      "Quote two-way markets on the total of 11 cards, trade 3 AI agents as the table reveals, and settle at the true sum.",
    icon: Users,
    color: "rose",
    watermark: "MOC",
  },
];

export default function MarketMakingHub() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge tone="accent">Market Making</Badge>
        <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">
          Market Making Games
        </h1>
        <p className="max-w-2xl text-muted">
          Interactive trading games that drill the mental math and decision-making
          behind a real trading desk. Pick one to play.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {games.map((g) => (
          <IconCard key={g.href} {...g} />
        ))}
      </div>
    </div>
  );
}
