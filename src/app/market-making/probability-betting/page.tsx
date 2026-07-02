import { BettingGame } from "@/components/betting-game";
import { HowToPlay } from "@/components/how-to-play";
import { BettingRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Probability Betting Game — QuantPrep",
};

export default function ProbabilityBettingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Probability & Edge"
        title="Probability Betting Game"
        description="Compute the true odds on dice, card and coin events, spot the bets the house has mispriced in your favour, and size them with Kelly."
      />
      <HowToPlay subtitle="Find the +EV bets and size them with Kelly.">
        <BettingRules />
      </HowToPlay>
      <BettingGame />
    </div>
  );
}
