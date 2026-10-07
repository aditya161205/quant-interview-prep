import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { TournamentGame } from "@/components/tournament-game";
import { HowToPlay } from "@/components/how-to-play";
import { TournamentRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Tournament Market — QuantPrep",
};

export default async function TournamentPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Probability & Estimation"
        title="Tournament Market"
        description="Given a 4-team win-probability matrix, price markets on who reaches the final, who lifts the trophy and how the group stage shakes out — then re-price as live results come in."
      />
      <HowToPlay subtitle="Price tournament outcomes, then trade the news.">
        <TournamentRules />
      </HowToPlay>
      <TournamentGame />
    </div>
  );
}
