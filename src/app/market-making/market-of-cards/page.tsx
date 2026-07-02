import { MarketOfCardsGame } from "@/components/market-of-cards-game";
import { HowToPlay } from "@/components/how-to-play";
import { MarketOfCardsRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Market of Cards — QuantPrep",
};

export default function MarketOfCardsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Group market making"
        title="Market of Cards"
        description="You and three AI traders quote two-way markets on the total value of 11 cards. Trade as the table is revealed each round, then settle at the true sum."
      />
      <HowToPlay subtitle="Quote the 11-card total, trade the AIs, settle at the truth.">
        <MarketOfCardsRules />
      </HowToPlay>
      <MarketOfCardsGame />
    </div>
  );
}
