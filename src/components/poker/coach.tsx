"use client";

import * as React from "react";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { ActionPlate } from "@/components/pit/game-kit";
import { GROUP_HINT, answerText, grade, type Answer, type Coaching, type Part, type Question } from "@/lib/poker/coach";
import { cn } from "@/lib/utils";

const PARTS: Part[] = ["My hand", "Their hand", "Compare", "Decision"];
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** The checklist before a decision: answer, check, read the working, then act. */
export function CoachQuiz({ coaching, onDone }: { coaching: Coaching; onDone: (points: number, max: number) => void }) {
  const { questions } = coaching;
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [checked, setChecked] = React.useState(false);
  const scores = checked ? questions.map((q) => grade(q, answers[q.id] ?? null)) : null;
  const points = scores?.reduce((a, b) => a + b, 0) ?? 0;

  return (
    <section aria-label="Coach" className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card) ring-4 ring-gold">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#0f131a] px-5 py-4 text-white">
        <span className="font-xx text-lg font-black uppercase">Before you act</span>
        <span className="text-sm text-white/70">
          {checked ? `Score ${fmt(points)} / ${questions.length}` : `${questions.length} questions · main opponent ${coaching.villainName}`}
        </span>
      </div>
      {PARTS.map((part) => {
        const qs = questions.filter((q) => q.part === part);
        if (!qs.length) return null;
        return (
          <div key={part} className="border-t border-border px-5 py-5">
            <h3 className="font-x mb-4 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{part}</h3>
            <ol className="space-y-6">
              {qs.map((q) => {
                const i = questions.indexOf(q);
                return (
                  <QuestionRow
                    key={q.id}
                    n={i + 1}
                    q={q}
                    value={answers[q.id] ?? null}
                    onChange={(a) => setAnswers((x) => ({ ...x, [q.id]: a }))}
                    score={scores ? scores[i] : null}
                  />
                );
              })}
            </ol>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-5 py-4">
        {checked ? (
          <>
            <span className="font-x text-sm font-extrabold">
              Score {fmt(points)} / {questions.length}
            </span>
            <ActionPlate tone="jacket" onClick={() => onDone(points, questions.length)} label="Make your decision" icon={<ArrowRight className="h-5 w-5" />} className="min-w-56" />
          </>
        ) : (
          <>
            <button onClick={() => onDone(0, 0)} className="font-x text-xs font-extrabold uppercase tracking-[0.06em] text-muted hover:text-foreground">
              Skip this one
            </button>
            <ActionPlate tone="jacket" onClick={() => setChecked(true)} label="Check my answers" className="min-w-56" />
          </>
        )}
      </div>
    </section>
  );
}

/** After the hand: were your decisions +EV, whatever the result? */
export function HandReview({ question, onScore }: { question: Question; onScore: (points: number) => void }) {
  const [value, setValue] = React.useState<Answer>(null);
  const [score, setScore] = React.useState<number | null>(null);
  return (
    <section aria-label="Hand review" className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="bg-[#0f131a] px-5 py-4 text-white">
        <span className="font-xx text-lg font-black uppercase">Hand review</span>
      </div>
      <ol className="px-5 py-5">
        <QuestionRow n={1} q={question} value={value} onChange={setValue} score={score} />
      </ol>
      {score === null && (
        <div className="flex justify-end border-t border-border bg-surface-2 px-5 py-4">
          <ActionPlate
            tone="jacket"
            disabled={value === null}
            onClick={() => {
              const s = grade(question, value);
              setScore(s);
              onScore(s);
            }}
            label="Check"
            className="min-w-40"
          />
        </div>
      )}
    </section>
  );
}

function QuestionRow({ n, q, value, onChange, score }: { n: number; q: Question; value: Answer; onChange: (a: Answer) => void; score: number | null }) {
  const done = score !== null;
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <span className="font-xx grid h-8 w-8 place-items-center rounded-[4px] bg-surface-2 text-sm font-black tabular-nums">{n}</span>
      <div className="min-w-0 space-y-3">
        <div>
          <p className="font-x font-extrabold">{q.title}</p>
          <p className="text-sm text-muted">{q.prompt}</p>
        </div>
        <Input q={q} value={value} onChange={onChange} done={done} />
        {done && <Feedback q={q} score={score} />}
      </div>
    </li>
  );
}

function Plate({ on, right, disabled, onClick, children }: { on: boolean; right?: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "font-x min-h-10 rounded-[4px] px-3 py-2 text-left text-sm font-bold transition-colors disabled:cursor-default",
        on ? "bg-jacket text-jacket-ink" : "bg-surface-2 hover:bg-border",
        right && "ring-2 ring-positive",
      )}
    >
      {children}
    </button>
  );
}

function Input({ q, value, onChange, done }: { q: Question; value: Answer; onChange: (a: Answer) => void; done: boolean }) {
  if (q.kind === "number") {
    return (
      <label className="flex items-center gap-2">
        <input
          inputMode="decimal"
          disabled={done}
          value={typeof value === "number" ? String(value) : typeof value === "string" ? value : ""}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9.]/g, "");
            onChange(t === "" ? null : t.endsWith(".") ? t : Number(t));
          }}
          aria-label={q.title}
          className="font-xx h-11 w-28 rounded-[6px] border-[1.5px] border-foreground bg-surface px-3 text-lg font-black tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
        />
        {q.unit && <span className="font-x font-extrabold text-muted">{q.unit}</span>}
      </label>
    );
  }
  if (q.kind === "grid") {
    const given = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {q.rows.map((row, i) => (
          <div key={row} className="flex flex-wrap items-center gap-2">
            <span className="w-32 shrink-0 text-sm font-bold">{row}</span>
            {q.options.map((o) => (
              <Plate
                key={o}
                on={given[i] === o}
                right={done && q.answer[i] === o}
                disabled={done}
                onClick={() => {
                  const next = [...given];
                  next[i] = o;
                  onChange(next);
                }}
              >
                {o}
              </Plate>
            ))}
          </div>
        ))}
      </div>
    );
  }
  const multi = q.kind === "multi";
  const chosen = multi ? (Array.isArray(value) ? value : []) : [value];
  const right = q.kind === "choice" ? q.accept : q.answer;
  return (
    <div className="flex flex-wrap gap-2">
      {q.options.map((o) => (
        <Plate
          key={o}
          on={chosen.includes(o)}
          right={done && right.includes(o)}
          disabled={done}
          onClick={() => onChange(multi ? (chosen.includes(o) ? chosen.filter((x) => x !== o) : [...chosen, o]) as string[] : o)}
        >
          {o}
          {o in GROUP_HINT && <span className="ml-1.5 text-xs font-semibold opacity-70">{GROUP_HINT[o as keyof typeof GROUP_HINT]}</span>}
        </Plate>
      ))}
    </div>
  );
}

function Feedback({ q, score }: { q: Question; score: number }) {
  const Icon = score === 1 ? Check : score > 0 ? Minus : X;
  return (
    <div className={cn("space-y-1.5 rounded-[8px] px-4 py-3 text-sm", score === 1 ? "bg-positive/12" : score > 0 ? "bg-(--hint-bg)" : "bg-negative/12")}>
      <p className="flex flex-wrap items-center gap-x-2 font-bold">
        <Icon className={cn("h-4 w-4", score === 1 ? "text-positive" : score > 0 ? "" : "text-negative")} strokeWidth={3} />
        {score === 1 ? "Right" : score > 0 ? "Close" : "Not quite"}
        {score < 1 && (
          <span className="font-normal">
            · answer: <strong>{answerText(q)}</strong>
          </span>
        )}
      </p>
      {q.why.map((w, i) => (
        <p key={i}>{w}</p>
      ))}
      {q.table && (
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-muted">
                {q.table.head.map((h, i) => (
                  <th key={h} className={cn("pb-1 font-bold", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.table.rows.map((r) => (
                <tr key={r[0]} className="border-t border-border/60">
                  {r.map((c, i) => (
                    <td key={i} className={cn("py-1", i > 0 && "text-right")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
