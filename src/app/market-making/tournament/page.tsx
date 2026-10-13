import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { TournamentGame } from "@/components/tournament-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { TournamentRules } from "@/components/game-rules";

export const metadata = {
  title: "Tournament Market — QuantPrep",
};

export default async function TournamentPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="TRN"
      title="Tournament Market"
      description="Given a 4-team win-probability matrix, price markets on who reaches the final, who lifts the trophy and how the group stage shakes out — then re-price as live results come in."
      rules={
        <HowToPlay subtitle="Price tournament outcomes, then trade the news.">
          <TournamentRules />
        </HowToPlay>
      }
    >
      <TournamentGame />
    </GameFrame>
  );
}
