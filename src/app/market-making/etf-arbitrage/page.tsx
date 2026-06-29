import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EtfGame } from "@/components/etf-game";
import { HowToPlay } from "@/components/how-to-play";
import { EtfArbitrageRules } from "@/components/game-rules";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "ETF Arbitrage Game — QuantPrep",
};

export default function EtfArbitragePage() {
  return (
    <div className="space-y-4">
      <Link
        href="/market-making"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Market Making games
      </Link>

      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">ETF Arbitrage Game</h1>
        <Badge tone="accent">Market Taking</Badge>
        <p className="w-full text-sm text-muted">
          Compute the NAV from the basket, compare it to the ETF&apos;s bid/ask,
          and take the edge before the AI traders do.
        </p>
      </header>

      <HowToPlay subtitle="Spot the ETF mispricing and take the edge.">
        <EtfArbitrageRules />
      </HowToPlay>
      <EtfGame />
    </div>
  );
}
