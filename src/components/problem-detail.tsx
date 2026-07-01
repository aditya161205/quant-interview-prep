"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X, Lightbulb, Loader2, HelpCircle, Timer, Play, Pause, RotateCcw } from "lucide-react";
import { usePracticeStore } from "@/store/practice-store";
import { ProblemActions } from "@/components/problem-actions";
import { MathText } from "@/components/math-text";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Difficulty, ProblemDetail as Detail, ProblemMeta } from "@/lib/problems";

export function ProblemDetail({ id }: { id: string }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ok" | "error">("loading");

  // Carry the list's filters through so prev/next walk the filtered set.
  const sp = useSearchParams();
  const qs = sp.toString();
  const solvedMap = usePracticeStore((s) => s.solved);
  const bookmarkedMap = usePracticeStore((s) => s.bookmarked);
  const [nav, setNav] = React.useState<{ prev: number | null; next: number | null }>({ prev: null, next: null });

  React.useEffect(() => {
    setStatus("loading");
    setDetail(null);
    fetch(`/api/problems/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Detail) => {
        setDetail(d);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  // Compute prev/next within the same filtered + ordered list as the table.
  React.useEffect(() => {
    const params = new URLSearchParams();
    for (const k of ["q", "difficulty", "category", "company"]) {
      const v = sp.get(k);
      if (v) params.set(k, v);
    }
    fetch(`/api/problems?${params}`)
      .then((r) => r.json())
      .then(({ problems }: { problems: ProblemMeta[] }) => {
        let list = problems ?? [];
        const st = sp.get("status");
        if (st === "Solved") list = list.filter((p) => solvedMap[String(p.id)]);
        else if (st === "Unsolved") list = list.filter((p) => !solvedMap[String(p.id)]);
        else if (st === "Bookmarked") list = list.filter((p) => bookmarkedMap[String(p.id)]);
        const idx = list.findIndex((p) => p.id === Number(id));
        setNav({
          prev: idx > 0 ? list[idx - 1].id : null,
          next: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
        });
      })
      .catch(() => {});
  }, [id, sp, solvedMap, bookmarkedMap]);

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
              {detail.category && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{detail.category}</span>}
            </div>
            <ProblemActions id={String(detail.id)} />
          </div>

          {detail.companies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Asked at</span>
              {detail.companies.map((c) => (
                <Badge key={c} tone="default">{c}</Badge>
              ))}
            </div>
          )}

          <h1 className="text-2xl font-black uppercase leading-[1.1] tracking-tight sm:text-3xl">{detail.title}</h1>

          <MathText text={detail.statement} className="text-[15px] leading-relaxed text-foreground/90" />

          {detail.hasAnswer && <AnswerCheck id={detail.id} />}

          {detail.hasHint && <HintReveal id={detail.id} />}

          <SolutionReveal id={detail.id} />
        </CardContent>
      </Card>

      <Stopwatch />
    </div>
  );
}

function HintReveal({ id }: { id: number }) {
  const [hints, setHints] = React.useState<string[] | null>(null);
  const [shown, setShown] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const revealNext = async () => {
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
      {hints && shown > 0 && (
        <div className="mb-3 space-y-2">
          {hints.slice(0, shown).map((h, i) => (
            <div key={i} className="animate-pop rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Hint {i + 1}
              </div>
              <MathText text={h} className="mt-1 text-sm leading-relaxed text-muted" />
            </div>
          ))}
        </div>
      )}
      {more && (
        <Button variant="outline" onClick={revealNext} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />}
          {hints === null ? "Show hint" : `Show next hint (${shown + 1}/${total})`}
        </Button>
      )}
    </div>
  );
}

function Stopwatch() {
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const startRef = React.useRef(0);

  React.useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed;
    const timer = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const totalSec = Math.floor(elapsed / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const time = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div className="glass fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-3 py-2">
      <Timer className="h-4 w-4 text-accent" />
      <span className="min-w-[3.25rem] text-center font-mono text-sm font-semibold tabular-nums">{time}</span>
      <button
        onClick={() => setRunning((r) => !r)}
        aria-label={running ? "Pause timer" : "Start timer"}
        className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-foreground transition-colors hover:bg-accent hover:text-white"
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => {
          setRunning(false);
          setElapsed(0);
        }}
        aria-label="Reset timer"
        className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AnswerCheck({ id }: { id: number }) {
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);
  const [value, setValue] = React.useState("");
  const [state, setState] = React.useState<"idle" | "checking" | "correct" | "wrong">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setState("checking");
    try {
      const r = await fetch(`/api/problems/${id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: value }),
      });
      const d: { correct: boolean } = await r.json();
      if (d.correct) {
        setState("correct");
        if (!usePracticeStore.getState().solved[String(id)]) toggleSolved(String(id));
      } else {
        setState("wrong");
      }
    } catch {
      setState("idle");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Your answer</span>
      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^0-9./-]/g, ""));
            if (state !== "idle") setState("idle");
          }}
          inputMode="decimal"
          placeholder="e.g. 0.5 or 1/2 (up to 3 decimals)"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 font-mono outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" disabled={state === "checking"}>
          {state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check answer"}
        </Button>
      </div>
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
    </form>
  );
}

function SolutionReveal({ id }: { id: number }) {
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
      <Button variant={open ? "outline" : "primary"} size="lg" onClick={reveal} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
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
