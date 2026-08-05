import type { Difficulty } from "@/lib/problems";
import { cn } from "@/lib/utils";

// Light mode uses the -800 shades: composited over the 10% tint the -600 shades
// only reach 2.8–3.9:1 and -700 still leaves amber at 4.38:1, under the 4.5:1 AA
// floor for this 12px text. -800 clears 6.1:1 on every surface a badge lands on.
// Dark mode keeps the -400 shades, which already sit above 6:1 on the same tint.
const styles: Record<Difficulty, string> = {
  Easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
  Hard: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-400",
};

const dot: Record<Difficulty, string> = {
  Easy: "bg-emerald-500",
  Medium: "bg-amber-500",
  Hard: "bg-rose-500",
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty | string;
  className?: string;
}) {
  const key = (["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : "Medium") as Difficulty;
  return (
    <span
      className={cn(
        "inline-flex w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[key],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[key])} />
      {difficulty || "—"}
    </span>
  );
}
