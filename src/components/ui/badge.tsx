import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "positive" | "negative" | "outline";

const tones: Record<Tone, string> = {
  default: "bg-surface-2 text-muted",
  accent: "bg-accent/15 text-accent border border-accent/30",
  positive: "bg-positive/15 text-positive border border-positive/30",
  negative: "bg-negative/15 text-negative border border-negative/30",
  outline: "border border-border text-muted",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
