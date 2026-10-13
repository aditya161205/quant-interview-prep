"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The rules sheet beside a game. On wide screens it stands open in its own column; on narrow ones it folds
 * above the game.
 */
export function HowToPlay({ subtitle = "How this game works.", children }: { subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <aside className="rounded-2xl bg-surface shadow-(--shadow-card) xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 border-b-[3px] border-jacket p-5 text-left xl:cursor-default"
      >
        <div className="flex-1">
          <div className="font-x text-lg font-black uppercase tracking-[0.02em]">Rules</div>
          <div className="text-sm text-muted">{subtitle}</div>
        </div>
        <ChevronDown className={cn("h-5 w-5 text-muted transition-transform xl:hidden", open && "rotate-180")} />
      </button>
      <div className={cn("space-y-5 p-5 text-sm leading-relaxed text-muted", open ? "block" : "hidden xl:block")}>{children}</div>
    </aside>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="font-x grid h-6 w-7 shrink-0 place-items-center rounded-[3px] bg-jacket text-xs font-black text-jacket-ink">{n}</span>
      <p>
        <span className="font-semibold text-foreground">{title}. </span>
        {children}
      </p>
    </div>
  );
}

/** A game page: the gold band with the game's badge, then the game beside its standing rules sheet. */
export function GameFrame({
  code,
  title,
  description,
  rules,
  children,
}: {
  code: string;
  title: string;
  description: string;
  rules: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="full-bleed mb-8 bg-jacket text-jacket-ink">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
          <Link href="/market-making" className="text-sm font-bold opacity-80 hover:opacity-100 sm:hidden">
            ← All games
          </Link>
          <span className="font-xx grid h-20 w-28 shrink-0 place-items-center rounded-[4px] bg-[#1a1300] text-3xl font-black tracking-[0.04em] text-gold">
            {code}
          </span>
          <div className="min-w-0">
            <Link href="/market-making" className="hidden text-sm font-bold opacity-80 hover:opacity-100 sm:inline">
              ← All games
            </Link>
            <h1 className="font-xx mt-1 text-[2.2rem] font-black leading-[0.95] tracking-[-0.02em] sm:text-[3rem]">{title}</h1>
            <p className="mt-2 max-w-3xl text-[1.0625rem] opacity-85">{description}</p>
          </div>
        </div>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 xl:order-1">{children}</div>
        <div className="xl:order-2">{rules}</div>
      </div>
    </div>
  );
}
