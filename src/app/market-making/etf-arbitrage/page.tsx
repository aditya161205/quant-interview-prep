import { EtfGame } from "@/components/etf-game";
import { HowToPlay } from "@/components/how-to-play";
import { EtfArbitrageRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "ETF Arbitrage Game — QuantPrep",
};

export default function EtfArbitragePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Market Taking"
        title="ETF Arbitrage Game"
        description="Compute the NAV from the basket, compare it to the ETF's bid/ask, and take the edge before the AI traders do."
      />
      <HowToPlay subtitle="Spot the ETF mispricing and take the edge.">
        <EtfArbitrageRules />
      </HowToPlay>
      <EtfGame />
    </div>
  );
}
