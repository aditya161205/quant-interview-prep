import { Spade, TrendingUp, Dices, Users, MoveHorizontal, Swords } from "lucide-react";
import { IconCard, type CardColor } from "@/components/icon-card";
import { PageHeader } from "@/components/page-header";

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
    color: "accent",
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
  {
    href: "/market-making/arrow-game",
    title: "Arrow Game",
    kicker: "Focus · Reaction",
    description:
      "React to the middle arrow only, ignore the flankers, and hold back on the no-go rounds — a fast test of focus, speed and impulse control.",
    icon: MoveHorizontal,
    color: "sky",
    watermark: "AR",
  },
  {
    href: "/market-making/tournament",
    title: "Tournament Market",
    kicker: "Probability · Estimation",
    description:
      "Price outcomes of a 4-team tournament from a win-probability matrix — finalists, champion, group-stage feats — then re-price as live results drop.",
    icon: Swords,
    color: "indigo",
    watermark: "TM",
  },
];

export default function MarketMakingHub() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Market Making"
        title="Market Making Games"
      />

      <div className="grid gap-5 md:grid-cols-2">
        {games.map((g) => (
          <IconCard key={g.href} {...g} />
        ))}
      </div>
    </div>
  );
}
