"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Gate, usePaths } from "@/components/paths/load";
import { Markdown } from "@/components/paths/markdown";
import { QuestionCard, questionDone } from "@/components/paths/question-card";
import { rememberTrack } from "@/components/paths/track-view";
import { api, KIND_LABEL, type PathsState, type QuestionStatus, type StepDetail, type StepSummary, type Track } from "@/lib/paths";
import { cn } from "@/lib/utils";

export const TASK_STATUS = {
  solved: ["Solved", "text-positive"],
  attempted: ["In progress", "text-amber-600 dark:text-amber-400"],
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

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-60">
        <Card className="p-4">
          <Link href={`/paths/${t.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All steps
          </Link>
          <RailGroup label="Path">
            <span className="text-sm font-semibold">{t.title}</span>
          </RailGroup>
          <RailGroup label="Step">
            <span className="font-mono text-2xl font-bold tabular-nums">
              {i + 1}
              <span className="text-base text-muted">/{t.steps.length}</span>
            </span>
          </RailGroup>
          <RailGroup label="Sections">
            <div className="space-y-1">
              <RailLink onClick={() => go("learn")} label="Learn" meta={read ? "✓" : ""} />
              {step.n_q > 0 && <RailLink onClick={() => go("check")} label="Check yourself" meta={`${doneQ}/${step.n_q}`} />}
              {step.n_p > 0 && <RailLink onClick={() => go("build")} label="Build" meta={`${doneP}/${step.n_p}`} />}
            </div>
          </RailGroup>
          <RailGroup label="Move">
            <div className="flex gap-2">
              <StepLink track={t.id} step={prev} direction="prev" />
              <StepLink track={t.id} step={next} direction="next" />
            </div>
          </RailGroup>
        </Card>
      </aside>

      <div className="w-full min-w-0 space-y-8">
        <Card className="obsidian-glow overflow-hidden">
          <CardContent className="p-6 sm:p-9">
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
              Step {i + 1} / {KIND_LABEL[step.kind]}
            </span>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">{step.title}</h1>

            <section id="learn" className="mt-8 scroll-mt-24">
              <Markdown text={step.lesson} className="max-w-3xl text-[0.9375rem] text-foreground/90" />
            </section>

            <div className="mt-8 border-t border-border/70 pt-6">
              <Button variant={read ? "outline" : "primary"} onClick={toggleRead}>
                {read ? (
                  <>
                    <Check className="h-4 w-4 text-positive" /> Lesson read
                  </>
                ) : (
                  "Mark lesson as read"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {step.questions.length > 0 && (
          <section id="check" className="scroll-mt-24 space-y-4">
            <SectionTitle title="Check yourself" meta={`${doneQ}/${step.n_q}`} />
            {step.questions.map((q, j) => (
              <QuestionCard
                key={q.id}
                q={q}
                label={`Question ${j + 1}`}
                onStatus={(id, st) => setStatuses((m) => ({ ...m, [id]: st }))}
              />
            ))}
          </section>
        )}

        {step.problems.length > 0 && (
          <section id="build" className="scroll-mt-24 space-y-4">
            <SectionTitle title="Build" meta={`${doneP}/${step.n_p}`} />
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              {step.problems.map((p, j) => {
                const [label, tone] = TASK_STATUS[p.status];
                return (
                  <Link
                    key={p.id}
                    href={`/paths/task/${p.id}?t=${t.id}`}
                    className="flex items-center gap-3 border-b border-border px-4 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-surface-2/40"
                  >
                    <span className="w-6 font-mono text-muted">{j + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                    <DifficultyBadge difficulty={p.difficulty} className="hidden sm:inline-flex" />
                    <span className={cn("w-24 text-right text-xs font-medium", tone)}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-border/70 pt-6 text-sm">
          {prev ? (
            <Link href={`/paths/${t.id}/${prev.id}`} className="text-muted hover:text-foreground">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/paths/${t.id}/${next.id}`} className="font-medium text-accent">
              {next.title} →
            </Link>
          ) : (
            <Link href={`/paths/${t.id}`} className="font-medium text-accent">
              Back to the path →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2 className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">{title}</h2>
      <span className="font-mono text-xs tabular-nums text-muted">{meta}</span>
    </div>
  );
}

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <span className="mb-2 block text-2xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
      {children}
    </div>
  );
}

function RailLink({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <span>{label}</span>
      <span className="font-mono text-xs tabular-nums">{meta}</span>
    </button>
  );
}

function StepLink({ track, step, direction }: { track: string; step?: StepSummary; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  const cls = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm";
  const body = (
    <>
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </>
  );
  if (!step) return <span className={cn(cls, "cursor-not-allowed text-muted/40")}>{body}</span>;
  return (
    <Link href={`/paths/${track}/${step.id}`} title={step.title} className={cn(cls, "transition-colors hover:border-accent/50 hover:text-accent")}>
      {body}
    </Link>
  );
}
