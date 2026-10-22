import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { StrategyGame } from "@/components/strategies/strategy-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { StrategiesRules } from "@/components/game-rules";

export const metadata = {
  title: "Options Strategies — QuantPrep",
};

export default async function StrategiesPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="STR"
      title="Options Strategies"
      description="Learn the classic option strategies until they stick: their payoff curves, Greek signs, risk and when to use each."
      rules={
        <HowToPlay subtitle="Name it, sign it, build it, use it.">
          <StrategiesRules />
        </HowToPlay>
      }
    >
      <StrategyGame />
    </GameFrame>
  );
}
