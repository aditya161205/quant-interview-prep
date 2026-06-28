import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BettingGame } from "@/components/betting-game";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Probability Betting Game — QuantPrep",
};

export default function ProbabilityBettingPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/market-making"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Market Making games
      </Link>

      <header>
        <Badge tone="accent" className="mb-3">
          Probability &amp; Edge
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Probability Betting Game
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Compute the true odds on dice, card and coin events, spot the bets the
          house has mispriced in your favour, and size them with Kelly.
        </p>
      </header>

      <BettingGame />
    </div>
  );
}
