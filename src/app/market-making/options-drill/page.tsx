import { hasPro } from "@/lib/billing";
import { Paywall } from "@/components/paywall";
import { OptionsDrill } from "@/components/options-drill";
import { GameFrame, HowToPlay } from "@/components/how-to-play";
import { OptionsDrillRules } from "@/components/game-rules";

export const metadata = {
  title: "Options Speed Drill — QuantPrep",
};

export default async function OptionsDrillPage() {
  if (!(await hasPro())) return <Paywall what="This game" />;
  return (
    <GameFrame
      code="OPT"
      title="Options Speed Drill"
      description="Rapid options mental math: parity, ATM approximations, delta hedges, payoffs and Greeks P&L, against the clock."
      rules={
        <HowToPlay subtitle="As many right answers as you can before time runs out.">
          <OptionsDrillRules />
        </HowToPlay>
      }
    >
      <OptionsDrill />
    </GameFrame>
  );
}
