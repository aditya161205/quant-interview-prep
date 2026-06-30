"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X, Lightbulb, Loader2 } from "lucide-react";
import { usePracticeStore } from "@/store/practice-store";
import { ProblemActions } from "@/components/problem-actions";
import { MathText } from "@/components/math-text";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Difficulty, ProblemDetail as Detail } from "@/lib/problems";

export function ProblemDetail({ id }: { id: string }) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ok" | "error">("loading");

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
        <Link href="/practice" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All problems
        </Link>
        <div className="flex items-center gap-2">
          <NavButton id={detail.prevId} direction="prev" />
          <NavButton id={detail.nextId} direction="next" />
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

          <SolutionReveal id={detail.id} />
        </CardContent>
      </Card>
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
  const [data, setData] = React.useState<{ answer: string; solution: string; hints: string } | null>(null);
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
          {data.hints && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Hint</div>
              <MathText text={data.hints} className="text-sm leading-relaxed text-muted" />
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

function NavButton({ id, direction }: { id: number | null; direction: "prev" | "next" }) {
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
    <Link href={`/practice/${id}`} className={cn(cls, "transition-colors hover:border-accent/50 hover:text-accent")}>
      {!isNext && <ArrowLeft className="h-4 w-4" />}
      {isNext ? "Next" : "Prev"}
      {isNext && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}
