import { PageHeader } from "@/components/page-header";
import { PokerGame } from "@/components/poker/poker-game";

export const metadata = {
  title: "Poker — QuantPrep",
};

export default function PokerPage() {
  return (
    <div>
      <PageHeader
        code="PKR"
        title="Poker"
        description="No-limit Texas Hold'em against bots that each get a fresh playing style, read the odds and adapt to how you play."
        compact
      />
      <PokerGame />
    </div>
  );
}
