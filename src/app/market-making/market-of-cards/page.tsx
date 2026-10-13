import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { MarketOfCardsGame } from "@/components/market-of-cards-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { MarketOfCardsRules } from "@/components/game-rules";

export const metadata = {
  title: "Market of Cards — QuantPrep",
};

export default async function MarketOfCardsPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="MOC"
      title="Market of Cards"
      description="You and three AI traders quote two-way markets on the total value of 11 cards. Trade as the table is revealed each round, then settle at the true sum."
      rules={
        <HowToPlay subtitle="Quote the 11-card total, trade the AIs, settle at the truth.">
          <MarketOfCardsRules />
        </HowToPlay>
      }
    >
      <MarketOfCardsGame />
    </GameFrame>
  );
}
