import type { Difficulty } from "@/data/problems";
import { cn } from "@/lib/utils";

const styles: Record<Difficulty, string> = {
  Easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Hard: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
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
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-[92px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[difficulty],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[difficulty])} />
      {difficulty}
    </span>
  );
}
