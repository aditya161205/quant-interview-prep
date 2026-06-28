"use client";

import * as React from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MIN_SPREAD, MAX_SPREAD } from "@/lib/market-game";

const values = [
  { label: "2 – 10", v: "face value" },
  { label: "J", v: "11" },
  { label: "Q", v: "12" },
  { label: "K", v: "13" },
  { label: "A", v: "14" },
];

export function HowToPlay() {
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
          <div className="text-sm text-muted">
            The rules of the rotating market-maker game.
          </div>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <CardContent className="animate-pop space-y-5 border-t border-border pt-5 text-sm leading-relaxed text-muted">
          <Step n={1} title="The instrument">
            Each round you see a small hand of cards — some face-up, some
            face-down. The tradable value is the{" "}
            <strong className="text-foreground">sum of all card values</strong>.
          </Step>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground">
              Card values
            </div>
            <div className="flex flex-wrap gap-2">
              {values.map((x) => (
                <Badge key={x.label} tone="outline">
                  <span className="font-mono font-semibold text-foreground">{x.label}</span>
                  <span className="mx-1.5 text-border">·</span>
                  {x.v}
                </Badge>
              ))}
            </div>
          </div>

          <Step n={2} title="The market maker rotates">
            One player is the <span className="text-accent">market maker</span>{" "}
            each round, rotating around the table. They post a two-sided quote
            shown as <span className="font-mono text-foreground">bid @ ask</span>{" "}
            — the price they&apos;ll buy at (bid) and sell at (ask). Spread must
            be between {MIN_SPREAD} and {MAX_SPREAD}.
          </Step>

          <Step n={3} title="When you're the maker">
            Enter a bid and ask around your estimate of fair value. If the true
            sum lands inside your market you{" "}
            <span className="text-positive">capture the spread</span> — and
            tighter correct markets earn more. If it lands outside, informed flow{" "}
            <span className="text-negative">picks you off</span>.
          </Step>

          <Step n={4} title="When a bot is the maker">
            You&apos;re the trader. Pick a size, then{" "}
            <span className="text-positive">Buy</span>{" "}at their ask if you
            think it&apos;s cheap, <span className="text-negative">Sell</span>{" "}at
            their bid if you think it&apos;s rich, or{" "}
            <span className="text-foreground">Skip</span>.
          </Step>

          <Step n={5} title="Settlement">
            All cards flip face-up and the hand settles at its true sum. Your
            PnL is booked to your score — try to estimate it in your head before
            you reveal, just like the desk interview.
          </Step>
        </CardContent>
      )}
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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
