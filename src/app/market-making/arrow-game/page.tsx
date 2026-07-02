import { ArrowGame } from "@/components/arrow-game";
import { HowToPlay } from "@/components/how-to-play";
import { ArrowGameRules } from "@/components/game-rules";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Arrow Game — QuantPrep",
};

export default function ArrowGamePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/market-making"
        backLabel="Market Making games"
        kicker="Focus & Reaction"
        title="Arrow Game"
        description="React to the middle arrow, ignore the flankers, and hold back on the no-go rounds. A fast test of focus, reaction speed and impulse control — the kind trading firms use to screen."
      />
      <HowToPlay subtitle="Middle arrow only — press left or right, unless it's boxed in by X.">
        <ArrowGameRules />
      </HowToPlay>
      <ArrowGame />
    </div>
  );
}
