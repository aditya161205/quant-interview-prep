"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Gate, usePaths } from "@/components/paths/load";
import { Markdown } from "@/components/paths/markdown";
import { QuestionCard, questionDone } from "@/components/paths/question-card";
import { rememberTrack } from "@/components/paths/track-view";
import { TRACK_JACKET } from "@/lib/pit";
import { api, KIND_LABEL, type PathsState, type QuestionStatus, type StepDetail, type StepSummary, type Track } from "@/lib/paths";
import { cn } from "@/lib/utils";

export const TASK_STATUS = {
  solved: ["Solved", "text-positive"],
  attempted: ["In progress", "text-(--hint-ink)"],
  new: ["Not started", "text-muted"],
} as const;

export function StepView({ trackId, stepId }: { trackId: string; stepId: string }) {
  const state = usePaths<PathsState>("state");
  const step = usePaths<StepDetail>(`step?id=${encodeURIComponent(stepId)}`);
  React.useEffect(() => rememberTrack(trackId), [trackId]);

  return (
    <Gate load={state}>
      {(s) => (
        <Gate load={step}>
          {(st) => {
            const t = s.tracks.find((x) => x.id === trackId);
            const i = t ? t.steps.findIndex((x) => x.id === stepId) : -1;
            if (!t || i < 0) {
              return (
                <div className="py-16 text-center text-muted">
                  This step isn&apos;t on that path. <Link href="/paths" className="text-accent">All paths</Link>
                </div>
              );
            }
            return <Step key={st.id} track={t} index={i} step={st} />;
          }}
        </Gate>
      )}
    </Gate>
  );
}

function Step({ track: t, index: i, step }: { track: Track; index: number; step: StepDetail }) {
  const [read, setRead] = React.useState(step.read);
  const [statuses, setStatuses] = React.useState<Record<string, QuestionStatus>>(() =>
    Object.fromEntries(step.questions.map((q) => [q.id, q.status])),
  );
  const doneQ = Object.values(statuses).filter(questionDone).length;
  const doneP = step.problems.filter((p) => p.status === "solved").length;
  const prev: StepSummary | undefined = t.steps[i - 1];
  const next: StepSummary | undefined = t.steps[i + 1];

  const toggleRead = async () => {
    await api("read", { id: step.id, value: !read });
    setRead(!read);
  };
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const look = TRACK_JACKET[t.id] ?? { color: "#1d3fbf", code: "P" };
  const tabs = [
    { id: "learn", label: "Learn", meta: read ? "Read" : "" },
    ...(step.n_q > 0 ? [{ id: "check", label: "Check yourself", meta: `${doneQ}/${step.n_q}` }] : []),
    ...(step.n_p > 0 ? [{ id: "build", label: "Build", meta: `${doneP}/${step.n_p}` }] : []),
  ];

  return (
    <div>
      <header className="full-bleed text-white" style={{ background: look.color }}>
        <div className="mx-auto max-w-[96rem] px-4 pb-8 pt-7 sm:px-6">
          <Link href={`/paths/${t.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold opacity-80 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> {t.title}
          </Link>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="font-xx grid h-16 min-w-[5.5rem] shrink-0 place-items-center rounded-[4px] bg-white text-2xl font-black tabular-nums" style={{ color: look.color }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="font-x text-xs font-extrabold uppercase tracking-[0.1em] opacity-80">
                {look.code} · Step {i + 1} of {t.steps.length} · {KIND_LABEL[step.kind]}
              </p>
              <h1 className="font-xx mt-1 text-[2.2rem] font-black leading-[0.95] tracking-[-0.02em] text-balance sm:text-[3rem]">{step.title}</h1>
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="Step sections" className="full-bleed z-30 mb-8 bg-surface shadow-(--shadow-card) lg:sticky lg:top-16">
        <div className="mx-auto flex max-w-[96rem] items-stretch gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => go(tab.id)}
              className="font-x flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-4 text-sm font-extrabold uppercase tracking-[0.06em] text-foreground transition-opacity hover:opacity-80"
              style={{ borderColor: look.color }}
            >
              {tab.label}
              {tab.meta && <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-foreground">{tab.meta}</span>}
            </button>
          ))}
          <span className="ml-auto flex shrink-0 items-center gap-2 py-2">
            <StepLink track={t.id} step={prev} direction="prev" />
            <StepLink track={t.id} step={next} direction="next" />
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl space-y-10">
        <section id="learn" className="scroll-mt-36 rounded-2xl bg-surface p-6 shadow-(--shadow-card) sm:p-10">
          <Markdown text={step.lesson} className="text-[1rem] text-foreground/90" />
          <div className="mt-10 border-t border-border pt-6">
            <Button variant={read ? "outline" : "secondary"} onClick={toggleRead}>
              {read ? (
                <>
                  <Check className="h-4 w-4 text-positive" /> Lesson read
                </>
              ) : (
                "Mark lesson as read"
              )}
            </Button>
          </div>
        </section>

        {step.questions.length > 0 && (
          <section id="check" className="scroll-mt-36 space-y-4">
            <SectionTitle title="Check yourself" meta={`${doneQ}/${step.n_q}`} color={look.color} />
            {step.questions.map((q, j) => (
              <QuestionCard key={q.id} q={q} label={`Question ${j + 1}`} onStatus={(id, st) => setStatuses((m) => ({ ...m, [id]: st }))} />
            ))}
          </section>
        )}

        {step.problems.length > 0 && (
          <section id="build" className="scroll-mt-36 space-y-4">
            <SectionTitle title="Build" meta={`${doneP}/${step.n_p}`} color={look.color} />
            <ol className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
              {step.problems.map((p, j) => {
                const [label, tone] = TASK_STATUS[p.status];
                return (
                  <li key={p.id} className="border-b border-border last:border-b-0">
                    <Link href={`/paths/task/${p.id}?t=${t.id}`} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-(--row-hover)">
                      <span className="font-xx grid h-10 w-11 place-items-center rounded-[4px] bg-surface-2 text-sm font-black">{`C${j + 1}`}</span>
                      <span className="min-w-0">
                        <span className="font-x block truncate font-extrabold">{p.title}</span>
                        <span className={cn("text-xs font-bold", tone)}>{label}</span>
                      </span>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link href={`/paths/${t.id}/${prev.id}`} className="rounded-2xl bg-surface p-5 shadow-(--shadow-card) transition hover:-translate-y-0.5">
              <span className="font-x text-xs font-extrabold uppercase tracking-[0.08em] text-muted">← Previous step</span>
              <span className="font-x mt-1 block font-extrabold">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={next ? `/paths/${t.id}/${next.id}` : `/paths/${t.id}`}
            className="rounded-2xl p-5 text-right text-white shadow-(--shadow-card) transition hover:-translate-y-0.5"
            style={{ background: look.color }}
          >
            <span className="font-x text-xs font-extrabold uppercase tracking-[0.08em] opacity-85">{next ? "Next step →" : "Path complete →"}</span>
            <span className="font-x mt-1 block font-extrabold">{next ? next.title : "Back to the path"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, meta, color }: { title: string; meta: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between border-b-[3px] pb-2" style={{ borderColor: color }}>
      <h2 className="font-xx text-2xl font-black uppercase">{title}</h2>
      <span className="font-x text-sm font-black tabular-nums text-muted">{meta}</span>
    </div>
  );
}

function StepLink({ track, step, direction }: { track: string; step?: StepSummary; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  const cls = "font-x inline-flex h-9 items-center gap-1.5 rounded-[6px] border-[1.5px] px-3 text-sm font-bold";
  const body = (
    <>
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </>
  );
  if (!step) return <span className={cn(cls, "cursor-not-allowed border-border text-muted/50")}>{body}</span>;
  return (
    <Link href={`/paths/${track}/${step.id}`} title={step.title} className={cn(cls, "border-foreground transition-colors hover:bg-foreground hover:text-background")}>
      {body}
    </Link>
  );
}
