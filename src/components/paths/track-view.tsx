"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Gate, usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { KIND_LABEL, nextStep, stepPct, trackPct, type Kind, type PathsState } from "@/lib/paths";
import { TRACK_JACKET } from "@/lib/pit";
import { cn } from "@/lib/utils";

/** Step types as plates: foundations quiet, projects and capstones loud. */
export const KIND_PLATE: Record<Kind, string> = {
  foundation: "bg-surface-2 text-foreground",
  core: "border-[1.5px] border-foreground/70 text-foreground",
  project: "bg-gold text-[#1a1300]",
  capstone: "bg-foreground text-background",
  interview: "bg-positive text-white",
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
              No such path. <Link href="/paths" className="font-bold text-jacket-text">All paths</Link>
            </div>
          );
        }
        const look = TRACK_JACKET[t.id] ?? { color: "#1d3fbf", code: "P" };
        const p = trackPct(t);
        const next = nextStep(t);
        return (
          <div>
            <header className="full-bleed mb-8 text-white" style={{ background: look.color }}>
              <div className="mx-auto max-w-[96rem] px-4 py-9 sm:px-6 sm:py-11">
                <Link href="/paths" className="inline-flex items-center gap-1.5 text-sm font-bold opacity-80 hover:opacity-100">
                  <ArrowLeft className="h-4 w-4" /> All paths
                </Link>
                <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
                  <div className="flex items-center gap-5">
                    <span className="font-xx grid h-16 min-w-[5.5rem] place-items-center rounded-[4px] bg-white text-2xl font-black" style={{ color: look.color }}>
                      {look.code}
                    </span>
                    <div>
                      <h1 className="font-xx text-[2.4rem] font-black leading-[0.95] tracking-[-0.02em] sm:text-[3.4rem]">{t.title}</h1>
                      <p className="mt-2 max-w-2xl opacity-90">{t.tagline}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-bold opacity-85">{t.steps.length} steps</span>
                      <span className="font-xx text-3xl font-black tabular-nums">{Math.round(100 * p)}%</span>
                    </div>
                    <ProgressBar value={p} onJacket />
                    <Link
                      href={`/paths/${t.id}/${next.id}`}
                      className="font-x mt-4 flex h-12 items-center justify-between rounded-[6px] bg-white px-5 font-bold transition hover:brightness-95"
                      style={{ color: look.color }}
                    >
                      <span className="truncate">
                        {p > 0 ? "Continue" : "Start"}: {next.title}
                      </span>
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </header>

            <ol className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
              <li
                aria-hidden
                className="font-x hidden grid-cols-[4rem_minmax(0,1fr)_8rem_5rem_7rem_6rem_7rem] gap-4 border-b-[3px] px-6 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-muted md:grid"
                style={{ borderColor: look.color }}
              >
                <span>Step</span>
                <span>Topic</span>
                <span>Type</span>
                <span>Lesson</span>
                <span>Questions</span>
                <span>Code</span>
                <span className="text-right">Done</span>
              </li>
              {t.steps.map((step, i) => {
                const k = stepPct(step);
                return (
                  <li key={step.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={step.locked ? "/pricing" : `/paths/${t.id}/${step.id}`}
                      className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-(--row-hover) md:grid-cols-[4rem_minmax(0,1fr)_8rem_5rem_7rem_6rem_7rem] md:px-6"
                    >
                      <span
                        className={cn(
                          "font-xx grid h-10 w-12 place-items-center rounded-[4px] text-base font-black tabular-nums",
                          k >= 1 ? "text-white" : "bg-surface-2 text-foreground",
                        )}
                        style={k >= 1 ? { background: look.color } : undefined}
                      >
                        {k >= 1 ? <Check className="h-5 w-5" /> : String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-x truncate text-[1.02rem] font-extrabold">{step.title}</span>
                          {step.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Pro" />}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted md:hidden">
                          {KIND_LABEL[step.kind]}
                          {step.n_q > 0 && ` · ${step.done_q}/${step.n_q} questions`}
                          {step.n_p > 0 && ` · ${step.done_p}/${step.n_p} code`}
                        </span>
                      </span>
                      <span className="hidden md:block">
                        <span className={cn("font-x inline-block rounded-[3px] px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.06em]", KIND_PLATE[step.kind])}>
                          {KIND_LABEL[step.kind]}
                        </span>
                      </span>
                      <span className={cn("hidden text-sm font-bold md:block", step.read ? "text-positive" : "text-muted")}>{step.read ? "Read" : "—"}</span>
                      <span className="hidden text-sm font-bold tabular-nums md:block">{step.n_q > 0 ? `${step.done_q} / ${step.n_q}` : "—"}</span>
                      <span className="hidden text-sm font-bold tabular-nums md:block">{step.n_p > 0 ? `${step.done_p} / ${step.n_p}` : "—"}</span>
                      <span className="flex items-center justify-end gap-3">
                        <span className="hidden h-2 w-12 overflow-hidden rounded-[2px] bg-surface-2 sm:block">
                          <span className="block h-full" style={{ width: `${Math.round(100 * k)}%`, background: look.color }} />
                        </span>
                        <span className="font-x w-10 text-right text-sm font-black tabular-nums">{Math.round(100 * k)}%</span>
                      </span>
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
