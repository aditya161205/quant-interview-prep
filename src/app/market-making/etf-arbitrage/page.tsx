import { EtfGame } from "@/components/etf-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { EtfArbitrageRules } from "@/components/game-rules";

export const metadata = {
  title: "ETF Arbitrage Game — QuantPrep",
};

export default function EtfArbitragePage() {
  return (
    <GameFrame
      code="ETF"
      title="ETF Arbitrage Game"
      description="Compute the NAV from the basket, compare it to the ETF's bid/ask, and take the edge before the AI traders do."
      rules={
        <HowToPlay subtitle="Spot the ETF mispricing and take the edge.">
          <EtfArbitrageRules />
        </HowToPlay>
      }
    >
      <EtfGame />
    </GameFrame>
  );
}
