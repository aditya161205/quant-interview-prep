import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, onJacket }: { value: number; className?: string; onJacket?: boolean }) {
  const pct = Math.round(100 * Math.min(1, Math.max(0, value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 overflow-hidden rounded-[2px]", onJacket ? "bg-white/25" : "bg-surface-2", className)}
    >
      <div className={cn("h-full transition-[width] duration-500", onJacket ? "bg-white" : "bg-jacket")} style={{ width: `${pct}%` }} />
    </div>
  );
}
