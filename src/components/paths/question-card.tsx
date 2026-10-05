"use client";

import * as React from "react";
import { Check, Eye, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/paths/markdown";
import { api, type Question, type QuestionStatus } from "@/lib/paths";
import { cn } from "@/lib/utils";

const STATUS: Record<QuestionStatus, [string, "default" | "accent" | "positive" | "negative" | "outline"]> = {
  new: ["", "default"],
  wrong: ["Not yet", "negative"],
  correct: ["Correct", "positive"],
  revealed: ["Answer shown", "outline"],
  gotit: ["Got it", "positive"],
  review: ["Review", "accent"],
};

type Reveal = { answer?: string; explanation?: string };
type Feedback = { tone: "ok" | "close" | "bad"; text: string };

export const questionDone = (s: QuestionStatus) => s === "correct" || s === "gotit";

/** One interview-style question: numeric, multiple choice, or open (reveal a model answer, then self-mark). */
export function QuestionCard({
  q,
  label,
  onStatus,
}: {
  q: Question;
  label: string;
  onStatus?: (id: string, status: QuestionStatus) => void;
}) {
  const [status, setStatus] = React.useState<QuestionStatus>(q.status);
  const [reveal, setReveal] = React.useState<Reveal | null>(
    q.answer != null || q.explanation ? { answer: q.answer, explanation: q.explanation } : null,
  );
  const [value, setValue] = React.useState("");
  const [choice, setChoice] = React.useState<number | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputId = React.useId();

  const update = (s: QuestionStatus) => {
    setStatus(s);
    onStatus?.(q.id, s);
  };

  const call = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setFeedback({
        tone: "bad",
        text: e instanceof Error ? e.message : "That didn't go through. Try again.",
      });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const answer = q.type === "number" ? value.trim() : choice;
    if (answer === "" || answer === null) {
      if (q.type === "choice") setFeedback({ tone: "bad", text: "Pick an option first." });
      return;
    }
    const r = await call(() =>
      api<Reveal & { correct?: boolean; close?: boolean; error?: string }>("answer", { id: q.id, answer: String(answer) }),
    );
    if (!r) return;
    if (r.error) return setFeedback({ tone: "bad", text: r.error });
    setFeedback(
      r.correct
        ? { tone: "ok", text: "Correct." }
        : r.close
          ? { tone: "close", text: "Close. Give a little more precision." }
          : { tone: "bad", text: "Not quite. Try again, or show the answer." },
    );
    if (r.correct) {
      setReveal({ answer: r.answer, explanation: r.explanation });
      update("correct");
    } else if (!questionDone(status)) {
      update("wrong");
    }
  };

  const show = async () => {
    const r = await call(() => api<Reveal>("show", { id: q.id }));
    if (!r) return;
    setReveal(r);
    if (!questionDone(status)) update("revealed");
  };

  const mark = async (v: "gotit" | "review") => {
    if (await call(() => api("selfmark", { id: q.id, value: v }))) update(v);
  };

  const [statusText, tone] = STATUS[status];

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
          {q.type === "open" && " · explain"}
        </span>
        {statusText && <Badge tone={tone}>{statusText}</Badge>}
      </div>

      <Markdown text={q.prompt} className="text-[0.9375rem] text-foreground/90" />

      <form onSubmit={check} className="mt-4 space-y-3">
        {q.type === "number" && (
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} className="sr-only">
              Your answer
            </label>
            <input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 1/6, 0.1667 or 12.5%"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="sm" className="h-10" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
            </Button>
          </div>
        )}

        {q.type === "choice" && (
          <>
            <div role="radiogroup" className="space-y-2">
              {(q.choices ?? []).map((c, j) => (
                <label
                  key={j}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                    choice === j ? "border-accent bg-accent/10" : "border-border hover:border-foreground/25",
                  )}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={choice === j}
                    onChange={() => setChoice(j)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <Markdown text={c} inline className="leading-relaxed" />
                </label>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
            </Button>
          </>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {q.type === "open" ? (
          <Button size="sm" variant={reveal ? "outline" : "primary"} onClick={show} disabled={busy}>
            <Eye className="h-4 w-4" /> {reveal ? "Model answer" : "Reveal model answer"}
          </Button>
        ) : (
          !reveal && (
            <button type="button" onClick={show} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              Show answer
            </button>
          )
        )}
        <div role="status" aria-live="polite">
          {feedback && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                feedback.tone === "ok" ? "text-positive" : feedback.tone === "close" ? "text-amber-500" : "text-negative",
              )}
            >
              {feedback.tone === "ok" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {feedback.text}
            </p>
          )}
        </div>
      </div>

      {reveal && (
        <div className="animate-pop mt-4 space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          {q.type !== "open" && reveal.answer != null && (
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-accent">Answer</div>
              <Markdown text={String(reveal.answer)} inline className="font-mono text-lg font-semibold" />
            </div>
          )}
          {reveal.explanation && <Markdown text={reveal.explanation} className="text-sm text-foreground/90" />}
          {q.type === "open" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant={status === "gotit" ? "primary" : "outline"} onClick={() => mark("gotit")} disabled={busy}>
                Got it
              </Button>
              <Button size="sm" variant={status === "review" ? "primary" : "outline"} onClick={() => mark("review")} disabled={busy}>
                Review later
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
