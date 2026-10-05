"use client";

import Link from "next/link";
import { ArrowRight, ChartCandlestick, FlaskConical, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Gate, usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { nextStep, trackPct, type PathsState, type Track } from "@/lib/paths";
import { cn } from "@/lib/utils";

const LOOK: Record<string, { icon: LucideIcon; tile: string; glow: string }> = {
  trader: { icon: ChartCandlestick, tile: "bg-emerald-500 text-white", glow: "bg-emerald-500" },
  researcher: { icon: FlaskConical, tile: "bg-accent text-accent-foreground", glow: "bg-accent" },
};

export function PathsHub() {
  const load = usePaths<PathsState>("state");
  return (
    <Gate load={load}>
      {(s) => (
        <div className="space-y-8">
          <section className="grid gap-5 md:grid-cols-2">
            {s.tracks.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </section>

        </div>
      )}
    </Gate>
  );
}

function TrackCard({ track: t }: { track: Track }) {
  const look = LOOK[t.id] ?? LOOK.researcher;
  const Icon = look.icon;
  const p = trackPct(t);
  const next = nextStep(t);
  const stats = [
    [t.steps.length, "steps"],
    [t.steps.reduce((a, s) => a + s.n_q, 0), "questions"],
    [t.steps.reduce((a, s) => a + s.n_p, 0), "coding tasks"],
    [t.steps.filter((s) => s.kind === "project" || s.kind === "capstone").length, "projects"],
  ] as const;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-(--shadow-card) sm:p-7">
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-3xl", look.glow)} />
      <span className={cn("relative grid h-12 w-12 place-items-center rounded-2xl shadow-lg", look.tile)}>
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="relative mt-6 text-2xl font-extrabold tracking-tight">{t.title}</h2>
      <p className="relative mt-2 text-sm leading-relaxed text-muted">{t.tagline}</p>

      <div className="relative mt-6 grid grid-cols-4 gap-3">
        {stats.map(([n, label]) => (
          <div key={label}>
            <div className="font-mono text-xl font-bold tabular-nums">{n}</div>
            <div className="text-2xs uppercase tracking-wider text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="relative mt-6">
        <ProgressBar value={p} />
        <p className="mt-2 text-xs text-muted">
          {Math.round(100 * p)}% complete{p > 0 && ` · next: ${next.title}`}
        </p>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link href={`/paths/${t.id}/${next.id}`}>
          <Button>
            {p > 0 ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/paths/${t.id}`}>
          <Button variant="outline">All steps</Button>
        </Link>
      </div>
    </div>
  );
}
