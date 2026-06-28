import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketGame } from "@/components/market-game";
import { HowToPlay } from "@/components/how-to-play";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Card Trading Game — QuantPrep",
};

export default function CardGamePage() {
  return (
    <div className="space-y-4">
      <Link
        href="/market-making"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Market Making games
      </Link>

      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Card Trading Game</h1>
        <Badge tone="accent">Market Making</Badge>
        <p className="w-full text-sm text-muted">
          Rotating market maker, hidden hand — quote tight when it&apos;s your
          turn, hunt edge against the bots when it isn&apos;t.
        </p>
      </header>

      <HowToPlay />
      <MarketGame />
    </div>
  );
}
