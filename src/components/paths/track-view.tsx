"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Gate, usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { KIND_LABEL, stepPct, trackPct, type Kind, type PathsState } from "@/lib/paths";
import { cn } from "@/lib/utils";

export const KIND_TONE: Record<Kind, "default" | "accent" | "positive" | "outline"> = {
  foundation: "outline",
  core: "default",
  project: "accent",
  capstone: "positive",
  interview: "default",
};

/** Remembers the path you're on, so a task opened from a shared step links back to the right one. */
export function rememberTrack(id: string) {
  try {
    localStorage.setItem("qp-track", id);
  } catch {}
}

export function TrackView({ trackId }: { trackId: string }) {
  const load = usePaths<PathsState>("state");
  React.useEffect(() => rememberTrack(trackId), [trackId]);

  return (
    <Gate load={load}>
      {(s) => {
        const t = s.tracks.find((x) => x.id === trackId);
        if (!t) {
          return (
            <div className="py-16 text-center text-muted">
              No such path. <Link href="/paths" className="text-accent">All paths</Link>
            </div>
          );
        }
        const p = trackPct(t);
        return (
          <div className="space-y-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <PageHeader kicker="Path" title={t.title} backHref="/paths" backLabel="All paths" />
              <div className="w-full shrink-0 sm:w-56">
                <ProgressBar value={p} />
                <p className="mt-2 text-xs text-muted">{Math.round(100 * p)}% complete</p>
              </div>
            </div>

            <ol className="space-y-3">
              {t.steps.map((step, i) => {
                const k = stepPct(step);
                return (
                  <li key={step.id}>
                    <Link
                      href={step.locked ? "/pricing" : `/paths/${t.id}/${step.id}`}
                      className={cn(
                        "group flex items-start gap-4 rounded-2xl border bg-surface p-4 shadow-(--shadow-card) transition-colors hover:border-foreground/25 sm:p-5",
                        step.kind === "capstone" ? "border-accent/50" : "border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-sm font-bold tabular-nums",
                          k >= 1
                            ? "border-positive bg-positive/15 text-positive"
                            : k > 0
                              ? "border-accent text-accent"
                              : "border-border text-muted",
                        )}
                      >
                        {k >= 1 ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tracking-[-0.01em]">{step.title}</span>
                          {step.locked && <Lock className="h-3.5 w-3.5 text-muted" aria-label="Pro" />}
                          {step.kind !== "core" && <Badge tone={KIND_TONE[step.kind]}>{KIND_LABEL[step.kind]}</Badge>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          <span className={cn(step.read && "text-positive")}>{step.read ? "✓ Lesson" : "Lesson"}</span>
                          {step.n_q > 0 && <span>Questions {step.done_q}/{step.n_q}</span>}
                          {step.n_p > 0 && <span>Code {step.done_p}/{step.n_p}</span>}
                        </div>
                      </div>
                      <div className="hidden w-24 shrink-0 pt-1 text-right sm:block">
                        {!step.locked && (
                          <>
                            <span className="font-mono text-xs tabular-nums text-muted">{Math.round(100 * k)}%</span>
                            <ProgressBar value={k} className="mt-1.5" />
                          </>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      }}
    </Gate>
  );
}
