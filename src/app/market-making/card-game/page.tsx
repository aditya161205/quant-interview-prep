import { MarketGame } from "@/components/market-game";
import { HowToPlay } from "@/components/how-to-play";
import { CardGameRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Card Trading Game — QuantPrep",
};

export default function CardGamePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Market Making"
        title="Card Trading Game"
        description="Rotating market maker, hidden hand — quote tight when it's your turn, hunt edge against the bots when it isn't."
      />
      <HowToPlay subtitle="The rotating market-maker card game.">
        <CardGameRules />
      </HowToPlay>
      <MarketGame />
    </div>
  );
}
