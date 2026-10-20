"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X, Lightbulb, Loader2, BookOpen, Timer, Hourglass, Play, Pause, RotateCcw, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { usePracticeStore } from "@/store/practice-store";
import { ProblemActions } from "@/components/problem-actions";
import { Paywall } from "@/components/paywall";
import { MathText } from "@/components/math-text";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Button } from "@/components/ui/button";
import { companyCode } from "@/lib/pit";
import { cn } from "@/lib/utils";
import { parseNumeric } from "@/lib/problems";
import type { Difficulty, ProblemDetail as Detail, ProblemMeta } from "@/lib/problems";

export function ProblemDetail({ id }: { id: string }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ok" | "error" | "locked">("loading");
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

  // Moving to another problem resets its state during render, before the fetch below.
  const [shownId, setShownId] = React.useState(id);
  if (shownId !== id) {
    setShownId(id);
    setStatus("loading");
    setDetail(null);
    setAttempted(false);
    setHints(null);
    setHintsShown(0);
    setSolution(null);
    setSolutionOpen(false);
  }

  React.useEffect(() => {
    // Ignore a slow response for a problem you've already moved past.
    let live = true;
    fetch(`/api/problems/${id}`)
      .then((r) => (r.status === 402 ? Promise.reject("locked") : r.ok ? r.json() : Promise.reject()))
      .then((d: Detail) => {
        if (!live) return;
        setDetail(d);
        setStatus("ok");
      })
      .catch((e) => live && setStatus(e === "locked" ? "locked" : "error"));
    return () => {
      live = false;
    };
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
  if (status === "locked") return <Paywall what="This problem" />;
  if (status === "error" || !detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-muted">This problem couldn&apos;t be loaded.</p>
        <Link href="/practice" className="text-sm text-accent">← All problems</Link>
      </div>
    );
  }

  return (
    <div>
      <header className="full-bleed mb-8 bg-jacket text-jacket-ink">
        <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
          <Link href={`/practice${qs ? `?${qs}` : ""}`} className="inline-flex items-center gap-1.5 text-sm font-bold opacity-80 hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> All problems
          </Link>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="font-xx grid h-16 min-w-[6rem] shrink-0 place-items-center rounded-[4px] bg-jacket-ink px-3 text-2xl font-black tabular-nums text-jacket">
              #{detail.id}
            </span>
            <div className="min-w-0">
              <h1 className="font-xx text-[2.2rem] font-black leading-[0.95] tracking-[-0.02em] text-balance sm:text-[3rem]">{detail.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={detail.difficulty as Difficulty} className="bg-jacket-ink! text-jacket!" />
                {detail.category && <span className="text-sm font-bold opacity-85">{detail.category}</span>}
                {detail.companies.map((c) => (
                  <span key={c} title={c} className="font-xx rounded-[3px] bg-black/25 px-2 py-1 text-xs font-black tracking-[0.06em]">
                    {companyCode(c)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <article className="min-w-0 space-y-5">
          <section className="rounded-2xl bg-surface p-6 shadow-(--shadow-card) sm:p-9">
            <MathText text={detail.statement} className="max-w-3xl text-[1.125rem] leading-[1.7] text-foreground" />
          </section>

          {/* Live region so each newly revealed hint is announced, not just shown. */}
          <div role="status" aria-live="polite" className="space-y-3 empty:hidden">
            {hints?.slice(0, hintsShown).map((h, i) => (
              <div key={i} className="animate-pop grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-2xl bg-(--hint-bg) p-5">
                <span className="font-xx grid h-9 w-14 place-items-center rounded-[3px] bg-gold text-sm font-black text-[#1a1300]">H{i + 1}</span>
                <MathText text={h} className="text-[0.95rem] leading-relaxed text-foreground/90" />
              </div>
            ))}
          </div>

          {solutionOpen && solution && (
            <section className="animate-pop overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
              {solution.answer && (
                <div className="flex flex-wrap items-baseline gap-4 bg-positive px-6 py-5 text-white">
                  <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] opacity-85">Answer</span>
                  <span className="font-xx text-2xl font-black">{solution.answer}</span>
                </div>
              )}
              {solution.solution && (
                <div className="p-6 sm:p-8">
                  <MathText text={solution.solution} className="max-w-3xl text-[0.98rem] leading-relaxed text-foreground/90" />
                </div>
              )}
            </section>
          )}
        </article>

        {/* The ticket: everything you do with the problem, in one fixed place. */}
        <aside className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card) lg:sticky lg:top-24">
          <div className="border-b-[3px] border-jacket px-5 py-4">
            <span className="font-x text-lg font-black uppercase">Ticket</span>
          </div>
          <div className="space-y-5 p-5">
            {detail.hasAnswer ? (
              <AnswerCheck id={detail.id} onAttempt={() => setAttempted(true)} />
            ) : (
              <p className="text-sm text-muted">This one has no single numeric answer. Work it, then compare with the solution.</p>
            )}
            <div className="grid gap-2">
              {detail.hasHint && moreHints && (
                <Button variant="outline" onClick={revealNextHint} disabled={hintLoading} className="w-full">
                  {hintLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                  {hints === null ? "Reveal a hint" : `Next hint (${hintsShown + 1}/${hintTotal})`}
                </Button>
              )}
              <Button variant={attempted || solutionOpen ? "secondary" : "ghost"} onClick={toggleSolution} disabled={solutionLoading} className="w-full">
                {solutionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {solutionOpen ? "Hide solution" : "Reveal solution"}
              </Button>
            </div>
            <div className="space-y-3 border-t border-border pt-5">
              <ProblemActions id={String(detail.id)} />
              <Stopwatch />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-5">
              <NavButton id={nav.prev} qs={qs} direction="prev" />
              <NavButton id={nav.next} qs={qs} direction="next" />
            </div>
          </div>
        </aside>
      </div>
    </div>
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
    <div className="flex items-center gap-1.5 rounded-[6px] bg-surface-2 p-1">
      {/* mode toggle */}
      <div className="flex items-center gap-0.5">
        {(["stopwatch", "timer"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-label={m === "stopwatch" ? "Stopwatch" : "Countdown timer"}
            aria-pressed={mode === m}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-[4px] transition-colors",
              mode === m ? "bg-foreground text-background" : "text-muted hover:text-foreground",
            )}
          >
            {m === "stopwatch" ? <Timer className="h-3.5 w-3.5" /> : <Hourglass className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>

      <span className={cn("font-x min-w-[3.5rem] text-center text-sm font-extrabold tabular-nums", done && "text-negative")}>
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
        className="grid h-7 w-7 place-items-center rounded-[4px] bg-jacket text-jacket-ink transition hover:brightness-110"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={reset}
        aria-label="Reset"
        className="grid h-7 w-7 place-items-center rounded-[4px] text-muted transition-colors hover:text-foreground"
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
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={inputId} className="font-x block text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
        Your answer
      </label>
      <div className="grid gap-2">
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
          className="font-x h-12 min-w-0 rounded-[6px] border-[1.5px] border-foreground bg-surface px-3 text-lg font-bold outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="lg" disabled={state === "checking"} className="w-full">
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
  const cls = "font-x inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] px-3 text-sm font-bold";
  if (id === null) {
    return (
      <span className={cn(cls, "cursor-not-allowed border-border text-muted/50")}>
        {!isNext && <ArrowLeft className="h-4 w-4" />}
        {isNext ? "Next" : "Prev"}
        {isNext && <ArrowRight className="h-4 w-4" />}
      </span>
    );
  }
  return (
    <Link href={`/practice/${id}${qs ? `?${qs}` : ""}`} className={cn(cls, "border-foreground transition-colors hover:bg-foreground hover:text-background")}>
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}
