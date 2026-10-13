import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "positive" | "negative" | "outline";

// Trader badges: rectangular plastic plates with expanded caps.
const tones: Record<Tone, string> = {
  default: "bg-surface-2 text-foreground",
  accent: "bg-jacket text-jacket-ink",
  positive: "bg-positive text-white",
  negative: "bg-negative text-white",
  outline: "border-[1.5px] border-current text-muted",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "font-x inline-flex items-center rounded-[3px] px-2 py-0.5 text-2xs font-extrabold uppercase tracking-[0.06em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A big three-letter trader badge: the Pit's stand-in for an icon. */
export function CodePlate({ code, className, style }: { code: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "font-xx inline-grid h-12 min-w-[4.25rem] shrink-0 place-items-center rounded-[4px] bg-white px-2 text-lg font-black tracking-[0.04em] text-[#0f131a] shadow-(--shadow-raised)",
        className,
      )}
    >
      {code}
    </span>
  );
}
