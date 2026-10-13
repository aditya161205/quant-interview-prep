import type { Difficulty } from "@/lib/problems";
import { cn } from "@/lib/utils";

// Solid plates in floor colours: green, gold, red. Text contrast is ≥4.5:1 on each.
const styles: Record<Difficulty, string> = {
  Easy: "bg-[#0f7a3f] text-white",
  Medium: "bg-[#e8a400] text-[#1a1300]",
  Hard: "bg-[#c8102e] text-white",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty | string; className?: string }) {
  const key = (["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : "Medium") as Difficulty;
  return (
    <span
      className={cn(
        "font-x inline-flex w-[4.75rem] shrink-0 items-center justify-center rounded-[3px] py-1 text-2xs font-extrabold uppercase tracking-[0.06em]",
        styles[key],
        className,
      )}
    >
      {difficulty || "—"}
    </span>
  );
}
