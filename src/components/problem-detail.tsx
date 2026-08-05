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
import { Badge } from "@/components/ui/badge";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/practice${qs ? `?${qs}` : ""}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All problems
        </Link>
        <div className="flex items-center gap-2">
          <NavButton id={nav.prev} qs={qs} direction="prev" />
          <NavButton id={nav.next} qs={qs} direction="next" />
        </div>
      </div>

      <Card className="obsidian-glow overflow-hidden">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">#{detail.id}</Badge>
              <DifficultyBadge difficulty={detail.difficulty as Difficulty} />
              {detail.category && <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{detail.category}</span>}
            </div>
            <ProblemActions id={String(detail.id)} />
          </div>

          {detail.companies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted">Asked at</span>
              {detail.companies.map((c) => (
                <Badge key={c} tone="default">{c}</Badge>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-bold leading-snug tracking-[-0.02em] sm:text-[1.75rem]">{detail.title}</h1>

          <MathText text={detail.statement} className="text-[0.9375rem] leading-relaxed text-foreground/90" />

          {detail.hasAnswer && <AnswerCheck id={detail.id} onAttempt={() => setAttempted(true)} />}

          {detail.hasHint && <HintReveal id={detail.id} onAttempt={() => setAttempted(true)} />}

          <SolutionReveal id={detail.id} attempted={attempted} />
        </CardContent>
      </Card>

      <Stopwatch />
    </div>
  );
}

function HintReveal({ id, onAttempt }: { id: number; onAttempt: () => void }) {
  const [hints, setHints] = React.useState<string[] | null>(null);
  const [shown, setShown] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const revealNext = async () => {
    onAttempt();
    if (hints === null) {
      setLoading(true);
      try {
        const r = await fetch(`/api/problems/${id}/hint`);
        const d: { hints: string[] } = await r.json();
        setHints(d.hints ?? []);
        setShown(1);
      } finally {
        setLoading(false);
      }
      return;
    }
    setShown((n) => Math.min(n + 1, hints.length));
  };

  const total = hints?.length ?? 0;
  const more = hints === null || shown < total;

  return (
    <div className="border-t border-border pt-5">
      {/* Live region so each newly revealed hint is announced, not just shown. */}
      <div role="status" aria-live="polite" className={cn("space-y-2", shown > 0 && "mb-3")}>
        {hints?.slice(0, shown).map((h, i) => (
          <div key={i} className="animate-pop rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Hint {i + 1}
            </div>
            <MathText text={h} className="mt-1 text-sm leading-relaxed text-muted" />
          </div>
        ))}
      </div>
      {more && (
        <Button variant="outline" onClick={revealNext} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4 text-amber-500" />}
          {hints === null ? "Show hint" : `Show next hint (${shown + 1}/${total})`}
        </Button>
      )}
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

function SolutionReveal({ id, attempted }: { id: number; attempted: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ answer: string; solution: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const reveal = async () => {
    if (data) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/problems/${id}/solution`);
      setData(await r.json());
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border pt-5">
      {/* Stays quiet until you've actually attempted — giving up shouldn't
          out-rank checking an answer — but is never gated or hidden. */}
      <Button variant={attempted || open ? "outline" : "ghost"} onClick={reveal} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
        {open ? "Hide solution" : "Reveal solution"}
      </Button>

      {open && data && (
        <div className="animate-pop mt-5 space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-5">
          {data.answer && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-accent">Answer</div>
              <div className="font-mono text-xl font-semibold">{data.answer}</div>
            </div>
          )}
          {data.solution && (
            <div className="border-t border-accent/20 pt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Solution</div>
              <MathText text={data.solution} className="text-sm leading-relaxed text-foreground/90" />
            </div>
          )}
        </div>
      )}
    </div>
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
