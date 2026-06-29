"use client";

import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** Consistent collapsible "How to play" panel used on every game page. */
export function HowToPlay({
  subtitle = "How this game works.",
  children,
}: {
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
          <HelpCircle className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="font-semibold">How to play</div>
          <div className="text-sm text-muted">{subtitle}</div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <CardContent className="animate-pop space-y-5 border-t border-border pt-5 text-sm leading-relaxed text-muted">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-accent">
        {n}
      </span>
      <p>
        <span className="font-semibold text-foreground">{title}. </span>
        {children}
      </p>
    </div>
  );
}
