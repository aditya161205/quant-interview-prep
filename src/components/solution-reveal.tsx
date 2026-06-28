"use client";

import * as React from "react";
import { Lightbulb, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SolutionReveal({
  answer,
  solution,
}: {
  answer: string;
  solution: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-t border-border pt-5">
      <Button
        variant={open ? "outline" : "primary"}
        size="lg"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Lightbulb className="h-4 w-4" />
        {open ? "Hide answer" : "Show answer"}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="animate-pop mt-5 overflow-hidden rounded-xl border border-accent/30 bg-accent/5">
          <div className="space-y-1.5 p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-accent">
              Answer
            </div>
            <div className="font-mono text-2xl font-semibold">{answer}</div>
          </div>
          <div className="border-t border-accent/20 bg-surface/40 p-5 text-sm leading-relaxed text-muted">
            {solution}
          </div>
        </div>
      )}
    </div>
  );
}
