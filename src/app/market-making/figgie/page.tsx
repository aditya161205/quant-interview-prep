import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { FiggieGame } from "@/components/figgie/figgie-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { FiggieRules } from "@/components/game-rules";

export const metadata = {
  title: "Figgie — QuantPrep",
};

export default async function FiggiePage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="FIG"
      title="Figgie"
      description="Jane Street's trading card game. Trade four suits against bots in real time, read the goal suit from the flow, and hold the most of it."
      rules={
        <HowToPlay subtitle="Find the goal suit and corner it.">
          <FiggieRules />
        </HowToPlay>
      }
    >
      <FiggieGame />
    </GameFrame>
  );
}
