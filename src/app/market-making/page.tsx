import Link from "next/link";
import { Spade, TrendingUp, Dices, Users, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Market Making Games — QuantPrep",
};

const games = [
  {
    href: "/market-making/card-game",
    title: "Card Trading Game",
    description:
      "The classic desk card game. A rotating market maker quotes a two-sided market on a hidden hand; trade against it or quote your own.",
    icon: Spade,
    tag: "Market making",
  },
  {
    href: "/market-making/etf-arbitrage",
    title: "ETF Arbitrage Game",
    description:
      "Compute an ETF's NAV from its basket, spot mispricings against the quoted bid/ask, and race 3 AI traders to capture the edge.",
    icon: TrendingUp,
    tag: "Market taking",
  },
  {
    href: "/market-making/probability-betting",
    title: "Probability Betting Game",
    description:
      "Price dice, card and coin events, spot the odds the house has mispriced in your favour, and size your bets with the Kelly Criterion.",
    icon: Dices,
    tag: "Probability",
  },
  {
    href: "/market-making/market-of-cards",
    title: "Market of Cards",
    description:
      "A 4-player group game: quote two-way markets on the total value of 11 cards, trade against 3 AI agents as the table is revealed, and settle at the true sum.",
    icon: Users,
    tag: "Group making",
  },
];

export default function MarketMakingHub() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge tone="accent">Market Making</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Market Making Games
        </h1>
        <p className="max-w-2xl text-muted">
          Interactive trading games that drill the mental math and decision-making
          behind a real trading desk. Pick one to play.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="group">
            <Card className="h-full transition-colors group-hover:border-accent/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
                    <g.icon className="h-6 w-6" />
                  </span>
                  <Badge tone="outline">{g.tag}</Badge>
                </div>
                <CardTitle className="mt-3">{g.title}</CardTitle>
                <CardDescription>{g.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Play
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
