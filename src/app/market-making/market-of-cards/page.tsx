import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketOfCardsGame } from "@/components/market-of-cards-game";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Market of Cards — QuantPrep",
};

export default function MarketOfCardsPage() {
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
          Group market making
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Market of Cards
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          You and three AI traders quote two-way markets on the total value of 11
          cards. Trade as the table is revealed each round, then settle at the
          true sum.
        </p>
      </header>

      <MarketOfCardsGame />
    </div>
  );
}
