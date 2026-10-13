"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { Countdown as StartCountdown } from "@/components/countdown";
import { cn } from "@/lib/utils";

/**
 * The Pit's game parts, shared by all six games: an order ticket for setup, plates for options, a heavy
 * countdown bar, a dark scoreboard strip, bid/ask plates and buy/sell/skip action plates.
 */

/** Setup screen: an order ticket with one row per setting and a full-width start. */
export function Ticket({
  children,
  onStart,
  startLabel = "Start game",
  note,
  countdown = true,
}: {
  children: React.ReactNode;
  onStart: () => void;
  startLabel?: string;
  note?: React.ReactNode;
  /** False when the game runs its own 3-2-1 after onStart. */
  countdown?: boolean;
}) {
  const [counting, setCounting] = React.useState(false);
  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-3 bg-[#0f131a] px-6 py-4 text-white">
        <span className="font-xx text-lg font-black uppercase tracking-[0.02em]">Order ticket</span>
        <span className="text-xs font-bold uppercase tracking-[0.1em] opacity-70">Set up your game</span>
      </div>
      <div className="divide-y divide-border px-6">{children}</div>
      {note && <div className="border-t border-border px-6 py-4 text-sm text-muted">{note}</div>}
      <button
        onClick={() => (countdown ? setCounting(true) : onStart())}
        className="font-xx flex w-full items-center justify-center gap-2 bg-jacket py-5 text-xl font-black uppercase tracking-[0.02em] text-jacket-ink transition hover:brightness-110"
      >
        <Play className="h-5 w-5 fill-current" /> {startLabel}
      </button>
      {counting && <StartCountdown onDone={() => { setCounting(false); onStart(); }} />}
    </section>
  );
}

/** One setting as a row of plates. */
export function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <span className="font-x text-sm font-extrabold uppercase tracking-[0.06em]">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            role="radio"
            aria-checked={value === opt}
            onClick={() => onChange(opt)}
            className={cn(
              "font-xx h-11 min-w-12 rounded-[4px] px-3 text-base font-black tabular-nums transition-colors",
              value === opt ? "bg-jacket text-jacket-ink" : "bg-surface-2 text-foreground hover:bg-border",
            )}
          >
            {opt}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An on/off setting row. */
export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <span className="font-x text-sm font-extrabold uppercase tracking-[0.06em]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "font-xx h-11 min-w-20 rounded-[4px] px-3 text-sm font-black uppercase transition-colors",
          checked ? "bg-jacket text-jacket-ink" : "bg-surface-2 text-muted",
        )}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

/** The countdown every timed phase uses: a heavy bar that turns red near the end. */
export function Timer({ seconds, onExpire, label = "Time to act" }: { seconds: number; onExpire: () => void; label?: string }) {
  const [left, setLeft] = React.useState(seconds);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 100);
    return () => clearInterval(id);
  }, [seconds, onExpire]);

  return <TimerBar left={left} total={seconds} label={label} />;
}

/** Just the bar, for games that keep their own clock. */
export function TimerBar({ left, total, label = "Time to act" }: { left: number; total: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const danger = left <= total * 0.35;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-x text-xs font-extrabold uppercase tracking-[0.08em] text-muted">{label}</span>
        <span className={cn("font-xx text-2xl font-black tabular-nums", danger && "text-negative")}>{Math.ceil(left)}s</span>
      </div>
      <div className="h-3 overflow-hidden rounded-[2px] bg-surface-2">
        <div className={cn("h-full transition-[width] duration-100 ease-linear", danger ? "bg-negative" : "bg-jacket")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export type Cell = { label: string; value: React.ReactNode; tone?: "good" | "bad" | "hot" };

/** The scoreboard strip across the top of a running game. */
export function Scoreboard({ cells, aside }: { cells: Cell[]; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-[#0f131a] text-white dark:ring-1 dark:ring-white/10 shadow-(--shadow-card) sm:flex-row sm:items-stretch">
      <dl className="grid flex-1 grid-cols-2 sm:flex sm:flex-wrap">
        {cells.map((c, i) => (
          <div key={c.label} className={cn("min-w-[8rem] flex-1 px-5 py-4", i > 0 && "border-l border-white/10")}>
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] opacity-60">{c.label}</dt>
            <dd
              className={cn(
                "font-xx mt-1 text-2xl font-black leading-none tabular-nums",
                c.tone === "good" && "text-[#5ee09a]",
                c.tone === "bad" && "text-[#ff7c8a]",
                c.tone === "hot" && "text-gold",
              )}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
      {aside && <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3 sm:border-l sm:border-t-0">{aside}</div>}
    </div>
  );
}

/** A white sheet with a jacket rule under its title. */
export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)", className)}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-jacket px-5 py-4">
          <h2 className="font-x text-lg font-black uppercase">{title}</h2>
          {meta}
        </div>
      )}
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

/** An instruction or verdict line. */
export function Note({ tone = "info", icon, children }: { tone?: "info" | "good" | "bad" | "warn"; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm",
        tone === "info" && "bg-surface-2 text-foreground",
        tone === "good" && "bg-positive/12 text-foreground",
        tone === "bad" && "bg-negative/12 text-foreground",
        tone === "warn" && "bg-(--hint-bg) text-foreground",
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Bid and ask as two solid plates. */
export function QuotePlates({ bid, ask, size = "md" }: { bid: React.ReactNode; ask: React.ReactNode; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "px-2 py-1 text-xs" : "px-4 py-2 text-lg";
  return (
    <span className="inline-flex items-stretch gap-1">
      <span className={cn("font-xx rounded-l-[4px] bg-positive font-black tabular-nums text-white", cls)}>
        <span className="mr-1.5 text-[0.65em] opacity-80">BID</span>
        {bid}
      </span>
      <span className={cn("font-xx rounded-r-[4px] bg-negative font-black tabular-nums text-white", cls)}>
        <span className="mr-1.5 text-[0.65em] opacity-80">ASK</span>
        {ask}
      </span>
    </span>
  );
}

/** A big number input for prices and answers. */
export function PriceField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-x mb-1.5 block text-xs font-extrabold uppercase tracking-[0.08em] text-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-xx h-14 w-full rounded-[6px] border-[1.5px] border-foreground bg-surface px-4 text-2xl font-black tabular-nums outline-none placeholder:text-base placeholder:font-semibold placeholder:text-muted/70 focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

/** Buy, sell, skip and similar trade actions as large plates. */
export function ActionPlate({
  tone,
  label,
  sub,
  icon,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: "buy" | "sell" | "neutral" | "jacket";
  label: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      {...props}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-[6px] px-3 py-3 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35",
        tone === "buy" && "bg-positive text-white hover:brightness-110",
        tone === "sell" && "bg-negative text-white hover:brightness-110",
        tone === "jacket" && "bg-jacket text-jacket-ink hover:brightness-110",
        tone === "neutral" && "border-[1.5px] border-foreground text-foreground hover:bg-foreground hover:text-background",
        className,
      )}
    >
      <span className="font-xx flex items-center gap-1.5 text-lg font-black uppercase">
        {label} {icon}
      </span>
      {sub && <span className="text-xs font-semibold opacity-80">{sub}</span>}
    </button>
  );
}

/** A labelled figure inside a panel. */
export function Stat({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="rounded-[6px] bg-surface-2 px-4 py-3">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className={cn("font-xx mt-1 text-xl font-black tabular-nums", ok === true && "text-positive", ok === false && "text-negative")}>{value}</div>
    </div>
  );
}

/** The end of a game: a jacket band with the headline figure, then whatever follows. */
export function FinalBand({
  title,
  figure,
  figureLabel,
  children,
  actions,
}: {
  title: string;
  figure?: React.ReactNode;
  figureLabel?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="flex flex-wrap items-end justify-between gap-6 bg-jacket px-6 py-8 text-jacket-ink sm:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">Game over</p>
          <h2 className="font-xx mt-1 text-[2.2rem] font-black uppercase leading-none tracking-[-0.02em]">{title}</h2>
        </div>
        {figure !== undefined && (
          <div className="text-right">
            <div className="font-xx text-[3.2rem] font-black leading-none tabular-nums">{figure}</div>
            {figureLabel && <div className="mt-1 text-xs font-bold uppercase tracking-[0.1em] opacity-75">{figureLabel}</div>}
          </div>
        )}
      </div>
      {children && <div className="space-y-5 p-6 sm:p-8">{children}</div>}
      {actions && <div className="flex flex-wrap justify-center gap-3 border-t border-border p-6">{actions}</div>}
    </section>
  );
}

/** Final ranking as numbered plates. */
export function Standings({ rows }: { rows: { name: string; score: React.ReactNode; you?: boolean }[] }) {
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.name}
          className={cn(
            "flex items-center gap-4 rounded-[8px] px-4 py-3",
            r.you ? "bg-foreground text-background" : "bg-surface-2",
          )}
        >
          <span className={cn("font-xx grid h-10 w-10 place-items-center rounded-[4px] text-lg font-black", i === 0 ? "bg-gold text-[#1a1300]" : r.you ? "bg-background/15" : "bg-surface")}>
            {i + 1}
          </span>
          <span className="font-x flex-1 text-lg font-extrabold">
            {r.name}
            {r.you && <span className="ml-2 text-xs font-bold uppercase tracking-[0.1em] opacity-70">You</span>}
          </span>
          <span className="font-xx text-2xl font-black tabular-nums">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** A secondary control under a game (restart, end game). */
export function QuietButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "font-x inline-flex h-10 items-center gap-1.5 rounded-[6px] px-3 text-sm font-bold text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
        className,
      )}
    />
  );
}
