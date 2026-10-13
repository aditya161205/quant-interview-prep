import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { BettingGame } from "@/components/betting-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { BettingRules } from "@/components/game-rules";

export const metadata = {
  title: "Probability Betting Game — QuantPrep",
};

export default async function ProbabilityBettingPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="PBT"
      title="Probability Betting Game"
      description="Compute the true odds on dice, card and coin events, spot the bets the house has mispriced in your favour, and size them with Kelly."
      rules={
        <HowToPlay subtitle="Find the +EV bets and size them with Kelly.">
          <BettingRules />
        </HowToPlay>
      }
    >
      <BettingGame />
    </GameFrame>
  );
}
