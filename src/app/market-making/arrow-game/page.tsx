import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { ArrowGame } from "@/components/arrow-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { ArrowGameRules } from "@/components/game-rules";

export const metadata = {
  title: "Arrow Game — QuantPrep",
};

export default async function ArrowGamePage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="ARW"
      title="Arrow Game"
      description="React to the middle arrow, ignore the flankers, and hold back on the no-go rounds. A fast test of focus, reaction speed and impulse control — the kind trading firms use to screen."
      rules={
        <HowToPlay subtitle="Middle arrow only — press left or right, unless it's boxed in by X.">
          <ArrowGameRules />
        </HowToPlay>
      }
    >
      <ArrowGame />
    </GameFrame>
  );
}
