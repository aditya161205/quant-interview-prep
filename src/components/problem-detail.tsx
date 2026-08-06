"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X, Lightbulb, Loader2, BookOpen, Timer, Hourglass, Play, Pause, RotateCcw, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { usePracticeStore } from "@/store/practice-store";
import { ProblemActions } from "@/components/problem-actions";
import { MathText } from "@/components/math-text";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseNumeric } from "@/lib/problems";
import type { Difficulty, ProblemDetail as Detail, ProblemMeta } from "@/lib/problems";

export function ProblemDetail({ id }: { id: string }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ok" | "error">("loading");
  // A check or a hint counts as an attempt — that's what earns the solution
  // reveal its emphasis (see SolutionReveal).
  const [attempted, setAttempted] = React.useState(false);
  // Hint/solution state lives here so the triggers can sit in the action bar
  // while their output renders in the body — and so both reset when the id
  // changes (they used to survive prev/next onto the following problem).
  const [hints, setHints] = React.useState<string[] | null>(null);
  const [hintsShown, setHintsShown] = React.useState(0);
  const [hintLoading, setHintLoading] = React.useState(false);
  const [solution, setSolution] = React.useState<{ answer: string; solution: string } | null>(null);
  const [solutionOpen, setSolutionOpen] = React.useState(false);
  const [solutionLoading, setSolutionLoading] = React.useState(false);

  // Carry the list's filters through so prev/next walk the filtered set.
  const sp = useSearchParams();
  const qs = sp.toString();
  const solvedMap = usePracticeStore((s) => s.solved);
  const bookmarkedMap = usePracticeStore((s) => s.bookmarked);
  const statusFilter = sp.get("status");
  // Ids of the server-filtered set, tagged with the query they came from so a
  // stale set is never used against different filters. `partial` marks a
  // paginated response that didn't hand back the whole set.
  const [idSet, setIdSet] = React.useState<{ qs: string; ids: number[]; partial: boolean } | null>(null);

  React.useEffect(() => {
    setStatus("loading");
    setDetail(null);
    setAttempted(false);
    setHints(null);
    setHintsShown(0);
    setSolution(null);
    setSolutionOpen(false);
    fetch(`/api/problems/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Detail) => {
        setDetail(d);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  // Only the server-side filters narrow the list; status is applied on the client.
  const listQs = React.useMemo(() => {
    const params = new URLSearchParams();
    for (const k of ["q", "difficulty", "category", "company"]) {
      const v = sp.get(k);
      if (v) params.set(k, v);
    }
    return params.toString();
  }, [sp]);

  // The detail response already carries prev/next for the same ordering the
  // table uses, so the id list is only worth fetching when a Status filter is
  // on — that one lives in localStorage and the server can't apply it.
  React.useEffect(() => {
    if (!statusFilter) return;
    const params = new URLSearchParams(listQs);
    // Ids only — we need every match to walk them, but none of the row data.
    params.set("fields", "ids");
    const ctrl = new AbortController();
    fetch(`/api/problems?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: ProblemMeta[] | { ids?: number[]; problems?: ProblemMeta[]; total?: number }) => {
        const rows = Array.isArray(d) ? d : (d.problems ?? []);
        const ids = !Array.isArray(d) && d.ids ? d.ids : rows.map((p) => p.id);
        const total = Array.isArray(d) ? ids.length : (d.total ?? ids.length);
        setIdSet({ qs: listQs, ids, partial: ids.length < total });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [statusFilter, listQs]);

  const hintTotal = hints?.length ?? 0;
  const moreHints = hints === null || hintsShown < hintTotal;

  const revealNextHint = async () => {
    setAttempted(true);
    if (hints === null) {
      setHintLoading(true);
      try {
        const r = await fetch(`/api/problems/${id}/hint`);
        const d: { hints: string[] } = await r.json();
        setHints(d.hints ?? []);
        setHintsShown(1);
      } finally {
        setHintLoading(false);
      }
      return;
    }
    setHintsShown((n) => Math.min(n + 1, hintTotal));
  };

  const toggleSolution = async () => {
    if (solution) {
      setSolutionOpen((o) => !o);
      return;
    }
    setSolutionLoading(true);
    try {
      const r = await fetch(`/api/problems/${id}/solution`);
      setSolution(await r.json());
      setSolutionOpen(true);
    } finally {
      setSolutionLoading(false);
    }
  };

  const nav = React.useMemo<{ prev: number | null; next: number | null }>(() => {
    if (!detail) return { prev: null, next: null };
    const fallback = { prev: detail.prevId, next: detail.nextId };
    if (!statusFilter || !idSet || idSet.qs !== listQs) return fallback;
    // Always keep the current problem in the list so its neighbours stay
    // reachable even after its own status changes (e.g. you solve it while
    // filtering by "Unsolved" — it shouldn't strand the prev/next buttons).
    const list = idSet.ids.filter((n) => {
      if (n === detail.id) return true;
      if (statusFilter === "Solved") return !!solvedMap[String(n)];
      if (statusFilter === "Unsolved") return !solvedMap[String(n)];
      if (statusFilter === "Bookmarked") return !!bookmarkedMap[String(n)];
      return true;
    });
    const idx = list.indexOf(detail.id);
    // If the ids we got back don't cover this problem, keep the server's
    // neighbours rather than stranding the buttons — same where a partial
    // response simply runs out before the walk does.
    if (idx < 0) return fallback;
    const edge = idSet.partial ? fallback : { prev: null, next: null };
    return {
      prev: idx > 0 ? list[idx - 1] : edge.prev,
      next: idx < list.length - 1 ? list[idx + 1] : edge.next,
    };
  }, [detail, statusFilter, listQs, idSet, solvedMap, bookmarkedMap]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (status === "error" || !detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-muted">This problem couldn&apos;t be loaded.</p>
        <Link href="/practice" className="text-sm text-accent">← All problems</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Navigation rail — the list lives here instead of forcing a trip back
          to the table for every problem. */}
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-60">
        <Card className="p-4">
          <Link
            href={`/practice${qs ? `?${qs}` : ""}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All problems
          </Link>

          <RailGroup label="Problem">
            <span className="font-mono text-2xl font-bold tabular-nums">#{detail.id}</span>
          </RailGroup>

          <RailGroup label="Level">
            <DifficultyBadge difficulty={detail.difficulty as Difficulty} />
          </RailGroup>

          <RailGroup label="Move">
            <div className="flex gap-2">
              <NavButton id={nav.prev} qs={qs} direction="prev" />
              <NavButton id={nav.next} qs={qs} direction="next" />
            </div>
          </RailGroup>
        </Card>
      </aside>

      {/* Question panel — full height, content at the top, actions pinned to
          the foot so they sit in the same place on every problem. */}
      <Card className="obsidian-glow flex min-h-[34rem] w-full flex-col overflow-hidden lg:min-h-[38rem]">
        <CardContent className="flex flex-1 flex-col p-6 sm:p-9">
          <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            Question / {detail.category || "Practice"}
          </span>

          <h1 className="mt-4 max-w-3xl text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[3rem]">
            {detail.title}
          </h1>

          <span className="mt-7 block text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
            Question
          </span>
          <MathText
            text={detail.statement}
            className="mt-3 max-w-3xl text-[1.0625rem] leading-[1.65] text-foreground/90"
          />

          {(detail.companies.length > 0 || detail.category) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {detail.category && <MetaPill>{detail.category}</MetaPill>}
              {detail.companies.map((c) => (
                <MetaPill key={c}>{c}</MetaPill>
              ))}
            </div>
          )}

          {detail.hasAnswer && (
            <div className="mt-8 max-w-2xl">
              <AnswerCheck id={detail.id} onAttempt={() => setAttempted(true)} />
            </div>
          )}

          {/* Live region so each newly revealed hint is announced, not just shown. */}
          <div role="status" aria-live="polite" className="max-w-3xl space-y-2 empty:hidden [&:not(:empty)]:mt-6">
            {hints?.slice(0, hintsShown).map((h, i) => (
              <div key={i} className="animate-pop rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="text-2xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Hint {i + 1}
                </div>
                <MathText text={h} className="mt-1 text-sm leading-relaxed text-muted" />
              </div>
            ))}
          </div>

          {solutionOpen && solution && (
            <div className="animate-pop mt-6 max-w-3xl space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-5">
              {solution.answer && (
                <div>
                  <div className="text-2xs font-semibold uppercase tracking-wider text-accent">Answer</div>
                  <div className="font-mono text-xl font-semibold">{solution.answer}</div>
                </div>
              )}
              {solution.solution && (
                <div className="border-t border-accent/20 pt-4">
                  <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted">Solution</div>
                  <MathText text={solution.solution} className="text-sm leading-relaxed text-foreground/90" />
                </div>
              )}
            </div>
          )}

          {/* Action bar: the commitment on the left, the escape hatches on the
              right, pushed to the foot of the panel. */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-6 sm:pt-8">
            <ProblemActions id={String(detail.id)} />
            <div className="flex flex-wrap items-center gap-2">
              {detail.hasHint && moreHints && (
                <Button variant="outline" onClick={revealNextHint} disabled={hintLoading}>
                  {hintLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4 text-amber-500" />}
                  {hints === null ? "Reveal hint" : `Next hint (${hintsShown + 1}/${hintTotal})`}
                </Button>
              )}
              {/* Stays quiet until you've actually attempted — giving up
                  shouldn't out-rank checking an answer — but is never gated. */}
              <Button
                variant={attempted || solutionOpen ? "outline" : "ghost"}
                onClick={toggleSolution}
                disabled={solutionLoading}
              >
                {solutionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {solutionOpen ? "Hide solution" : "Reveal solution"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Stopwatch />
    </div>
  );
}

/** A labelled block in the navigation rail. */
function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <span className="mb-2 block text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Metadata chip — category and the companies a problem has been asked at. */
function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2/70 px-3.5 py-1.5 text-sm text-muted">
      {children}
    </span>
  );
}


function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Stopwatch() {
  const [mode, setMode] = React.useState<"stopwatch" | "timer">("stopwatch");
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0); // stopwatch: ms counted up
  const [durationMin, setDurationMin] = React.useState(5); // timer: chosen minutes
  const [remaining, setRemaining] = React.useState(5 * 60_000); // timer: ms left
  const anchorRef = React.useRef(0);

  const done = mode === "timer" && remaining <= 0;

  // Stopwatch tick
  React.useEffect(() => {
    if (!running || mode !== "stopwatch") return;
    anchorRef.current = Date.now() - elapsed;
    const t = setInterval(() => setElapsed(Date.now() - anchorRef.current), 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  // Timer tick (counts down, stops at 0)
  React.useEffect(() => {
    if (!running || mode !== "timer") return;
    const end = Date.now() + remaining;
    const t = setInterval(() => {
      const rem = end - Date.now();
      if (rem <= 0) {
        setRemaining(0);
        setRunning(false);
        clearInterval(t);
      } else {
        setRemaining(rem);
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  const switchMode = (m: "stopwatch" | "timer") => {
    setRunning(false);
    setMode(m);
  };
  const reset = () => {
    setRunning(false);
    if (mode === "stopwatch") setElapsed(0);
    else setRemaining(durationMin * 60_000);
  };
  const setMinutes = (min: number) => {
    const clamped = Math.max(1, Math.min(180, min));
    setDurationMin(clamped);
    setRemaining(clamped * 60_000);
    setRunning(false);
  };

  return (
    <div className="glass fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-2">
      {/* mode toggle */}
      <div className="flex items-center gap-0.5 rounded-full bg-surface-2/60 p-0.5">
        {(["stopwatch", "timer"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-label={m === "stopwatch" ? "Stopwatch" : "Countdown timer"}
            aria-pressed={mode === m}
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full transition-colors",
              mode === m ? "bg-foreground text-background" : "text-muted hover:text-foreground",
            )}
          >
            {m === "stopwatch" ? <Timer className="h-3.5 w-3.5" /> : <Hourglass className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>

      <span className={cn("min-w-[3.5rem] text-center font-mono text-sm font-semibold tabular-nums", done && "text-negative")}>
        {mode === "stopwatch" ? fmt(elapsed) : fmt(remaining)}
      </span>

      {/* compact minute stepper (timer, when idle) */}
      {mode === "timer" && !running && (
        <div className="-my-1 flex flex-col text-muted">
          <button onClick={() => setMinutes(durationMin + 1)} aria-label="More time" className="hover:text-foreground">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setMinutes(durationMin - 1)} aria-label="Less time" className="hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        onClick={() => (done ? reset() : setRunning((r) => !r))}
        aria-label={running ? "Pause" : "Start"}
        className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white transition-colors hover:opacity-90"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={reset}
        aria-label="Reset"
        className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AnswerCheck({ id, onAttempt }: { id: number; onAttempt: () => void }) {
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);
  const [value, setValue] = React.useState("");
  const [state, setState] = React.useState<"idle" | "checking" | "correct" | "wrong" | "invalid" | "failed">("idle");
  const inputId = React.useId();
  const helpId = React.useId();
  const msgId = React.useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate here rather than filtering keystrokes, so nothing the user types
    // disappears without an explanation.
    if (parseNumeric(value) === null) {
      setState("invalid");
      return;
    }
    onAttempt();
    setState("checking");
    try {
      const r = await fetch(`/api/problems/${id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      // A failed request is not a wrong answer — saying "not quite" to someone
      // whose session expired sends them rewriting a correct solution.
      if (!r.ok) {
        setState("failed");
        return;
      }
      const d: { correct: boolean } = await r.json();
      if (d.correct) {
        setState("correct");
        if (!usePracticeStore.getState().solved[String(id)]) toggleSolved(String(id));
      } else {
        setState("wrong");
      }
    } catch {
      setState("failed");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-5">
      <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-muted">
        Your answer
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state !== "idle") setState("idle");
          }}
          inputMode="decimal"
          placeholder="0.5 or 1/2"
          aria-describedby={`${helpId} ${msgId}`}
          aria-invalid={state === "invalid"}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 font-mono outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="lg" disabled={state === "checking"}>
          {state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check answer"}
        </Button>
      </div>
      {/* The format rule stays put — a placeholder vanishes as soon as you type. */}
      <p id={helpId} className="text-xs text-muted">
        A decimal or a simple fraction — e.g. 0.5 or 1/2 (matched to 3 decimals).
      </p>
      {/* Persistent live region so the verdict is announced, not only shown. */}
      <div id={msgId} role="status" aria-live="polite">
        {state === "correct" && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-positive">
            <Check className="h-4 w-4" /> Correct — marked complete.
          </p>
        )}
        {state === "wrong" && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-negative">
            <X className="h-4 w-4" /> Not quite — try again or reveal the solution.
          </p>
        )}
        {state === "invalid" && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-negative">
            <X className="h-4 w-4" /> Enter a decimal like 0.5 or a fraction like 1/2.
          </p>
        )}
        {state === "failed" && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <AlertTriangle className="h-4 w-4" /> Couldn&apos;t reach the server — your answer wasn&apos;t
            checked. Try again.
          </p>
        )}
      </div>
    </form>
  );
}


function NavButton({ id, qs, direction }: { id: number | null; qs: string; direction: "prev" | "next" }) {
  const isNext = direction === "next";
  const cls = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm";
  if (id === null) {
    return (
      <span className={cn(cls, "cursor-not-allowed text-muted/40")}>
        {!isNext && <ArrowLeft className="h-4 w-4" />}
        {isNext ? "Next" : "Prev"}
        {isNext && <ArrowRight className="h-4 w-4" />}
      </span>
    );
  }
  return (
    <Link href={`/practice/${id}${qs ? `?${qs}` : ""}`} className={cn(cls, "transition-colors hover:border-accent/50 hover:text-accent")}>
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}
