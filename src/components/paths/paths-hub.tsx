"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Gate, usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { nextStep, trackPct, type PathsState, type Track } from "@/lib/paths";
import { TRACK_JACKET } from "@/lib/pit";

export function PathsHub() {
  const load = usePaths<PathsState>("state");
  return (
    <Gate load={load}>
      {(s) => (
        <div className="grid gap-5 lg:grid-cols-2">
          {s.tracks.map((t) => (
            <TrackJacket key={t.id} track={t} />
          ))}
        </div>
      )}
    </Gate>
  );
}

/** A path as a jacket: its colour fills the panel, its badge code leads. */
function TrackJacket({ track: t }: { track: Track }) {
  const look = TRACK_JACKET[t.id] ?? { color: "#1b2a4a", code: t.title.slice(0, 2).toUpperCase() };
  const p = trackPct(t);
  const next = nextStep(t);
  const stats = [
    [t.steps.length, "steps"],
    [t.steps.reduce((a, s) => a + s.n_q, 0), "questions"],
    [t.steps.reduce((a, s) => a + s.n_p, 0), "coding tasks"],
    [t.steps.filter((s) => s.kind === "project" || s.kind === "capstone").length, "projects"],
  ] as const;

  return (
    <section className="flex flex-col rounded-2xl p-7 text-white shadow-(--shadow-card) sm:p-9" style={{ background: look.color }}>
      <div className="flex items-center gap-5">
        <span className="font-xx grid h-16 min-w-[5.5rem] place-items-center rounded-[4px] bg-white text-2xl font-black" style={{ color: look.color }}>
          {look.code}
        </span>
        <h2 className="font-xx text-[2.2rem] font-black leading-[0.95] tracking-[-0.02em]">{t.title}</h2>
      </div>
      <p className="mt-5 max-w-lg leading-relaxed opacity-90">{t.tagline}</p>

      <dl className="mt-7 grid grid-cols-4 overflow-hidden rounded-[6px] bg-black/20">
        {stats.map(([n, label], i) => (
          <div key={label} className={`px-3 py-4 ${i ? "border-l border-white/15" : ""}`}>
            <dd className="font-xx text-2xl font-black tabular-nums">{n}</dd>
            <dt className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] opacity-80">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between text-sm font-bold">
          <span className="opacity-85">{p > 0 ? `Next: ${next.title}` : "Not started"}</span>
          <span className="font-x font-black tabular-nums">{Math.round(100 * p)}%</span>
        </div>
        <ProgressBar value={p} onJacket />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/paths/${t.id}/${next.id}`}
          className="font-x inline-flex h-12 items-center gap-2 rounded-[6px] bg-white px-6 font-bold transition hover:brightness-95"
          style={{ color: look.color }}
        >
          {p > 0 ? "Continue" : "Start"} <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/paths/${t.id}`}
          className="font-x inline-flex h-12 items-center rounded-[6px] border-[1.5px] border-white px-6 font-bold transition hover:bg-white/15"
        >
          All {t.steps.length} steps
        </Link>
      </div>
    </section>
  );
}
