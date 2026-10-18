import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { AuctionGame } from "@/components/auction-game";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { AuctionRules } from "@/components/game-rules";

export const metadata = {
  title: "Sealed-Bid Auction — QuantPrep",
};

export default async function AuctionPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="AUC"
      title="Sealed-Bid Auction"
      description="Bid against bots on items worth the same to everyone, from a noisy private estimate. Beat the winner's curse."
      rules={
        <HowToPlay subtitle="Win lots without overpaying for them.">
          <AuctionRules />
        </HowToPlay>
      }
    >
      <AuctionGame />
    </GameFrame>
  );
}
