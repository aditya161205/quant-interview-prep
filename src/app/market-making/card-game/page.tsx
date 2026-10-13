import { MarketGame } from "@/components/market-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { CardGameRules } from "@/components/game-rules";

export const metadata = {
  title: "Card Trading Game — QuantPrep",
};

export default function CardGamePage() {
  return (
    <GameFrame
      code="CTG"
      title="Card Trading Game"
      description="Rotating market maker, hidden hand — quote tight when it's your turn, hunt edge against the bots when it isn't."
      rules={
        <HowToPlay subtitle="The rotating market-maker card game.">
          <CardGameRules />
        </HowToPlay>
      }
    >
      <MarketGame />
    </GameFrame>
  );
}
