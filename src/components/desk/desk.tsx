"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock, Minus, RotateCcw, X } from "lucide-react";
import { CAREERS, DAYS_TO_UNLOCK_WEEK, LEVELS, answerText, grade, makeDay, num, signedMoney, type Answer, type Block, type Day, type Outcome, type Role, type Task } from "@/lib/desk";
import { dayId, dayStatus, useDesk } from "@/store/desk-store";
import { useMounted, useRecordGame } from "@/store/practice-store";
import { ActionPlate, Scoreboard } from "@/components/pit/game-kit";
import { cn } from "@/lib/utils";

const fmtMetric = (role: Role, x: number) => (role === "trader" ? signedMoney(x) : `${x > 0 ? "+" : ""}${x} pts`);
const letter = (s: number) => (s >= 0.85 ? "A" : s >= 0.7 ? "B" : s >= 0.55 ? "C" : "D");
const LEVEL_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

/** The journey: pick a career, then work through it day by day. */
export function DeskApp({ pro }: { pro: boolean }) {
  const mounted = useMounted();
  const [role, setRole] = React.useState<Role>("trader");
  // Each start is a new run with a fresh seed; the run number remounts the day so nothing carries over.
  const [run, setRun] = React.useState<{ day: Day; id: number } | null>(null);

  // A day in progress gets the bar to itself, like a game or a question.
  React.useEffect(() => {
    if (!run) return;
    document.documentElement.setAttribute("data-focus", "");
    return () => document.documentElement.removeAttribute("data-focus");
  }, [run]);
  const start = (r: Role, n: number) => setRun((prev) => ({ day: makeDay(r, n, Math.floor(Math.random() * 2 ** 31)), id: (prev?.id ?? 0) + 1 }));

  if (!mounted) return <div className="h-96" />;
  if (run) return <DayRun key={run.id} day={run.day} pro={pro} onLeave={() => setRun(null)} onPlay={(n) => start(run.day.role, n)} />;
  return <Journey role={role} setRole={setRole} pro={pro} onStart={(n) => start(role, n)} />;
}

/* ------------------------------------------------------------------ journey */

function Journey({ role, setRole, pro, onStart }: { role: Role; setRole: (r: Role) => void; pro: boolean; onStart: (n: number) => void }) {
  const records = useDesk((s) => s.records);
  const done = (r: Role) => LEVELS.flatMap((l) => l.days).filter((n) => records[dayId(r, n)]);
  const mine = done(role);
  const avg = mine.length ? mine.reduce((a, n) => a + records[dayId(role, n)].best, 0) / mine.length : 0;
  const total = mine.reduce((a, n) => a + records[dayId(role, n)].metric, 0);
  const rank = [...LEVELS].reverse().find((l) => dayStatus(records, role, l.days[0], true) === "open")?.title ?? "Junior";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(Object.keys(CAREERS) as Role[]).map((r) => {
          const c = CAREERS[r];
          const on = r === role;
          return (
            <button
              key={r}
              onClick={() => setRole(r)}
              aria-pressed={on}
              className={cn(
                "min-w-0 rounded-2xl p-5 text-left shadow-(--shadow-card) transition-colors",
                on ? "bg-jacket text-jacket-ink" : "bg-surface hover:bg-surface-2",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-xx text-xl font-black uppercase sm:text-2xl">{c.title}</span>
                <span className={cn("text-xs font-bold", on ? "opacity-80" : "text-muted")}>{done(r).length}/15 days</span>
              </div>
              <div className={cn("mt-1 text-xs font-extrabold uppercase tracking-[0.08em]", on ? "opacity-80" : "text-muted")}>{c.desk}</div>
              <p className={cn("mt-3 text-sm", on ? "opacity-90" : "text-muted")}>{c.blurb}</p>
            </button>
          );
        })}
      </div>

      <Scoreboard
        cells={[
          { label: "Title", value: rank, tone: "hot" },
          { label: "Days done", value: `${mine.length}/15` },
          { label: "Average", value: mine.length ? `${Math.round(avg * 100)}%` : "—" },
          { label: role === "trader" ? "Career P&L" : "Credibility", value: mine.length ? fmtMetric(role, total) : "—", tone: total > 0 ? "good" : total < 0 ? "bad" : undefined },
        ]}
      />

      {LEVELS.map((lv) => (
        <section key={lv.week} className="rounded-2xl bg-surface shadow-(--shadow-card)">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-(--jacket-text) px-5 py-4">
            <h2 className="font-x text-lg font-black uppercase">
              Week {lv.week} · {lv.title}
            </h2>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
              {LEVEL_LABEL[lv.level]}
              {lv.week > 1 && ` · opens after ${DAYS_TO_UNLOCK_WEEK} days of week ${lv.week - 1}`}
            </span>
          </div>
          <ol className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {lv.days.map((n) => {
              const status = dayStatus(records, role, n, pro);
              const rec = records[dayId(role, n)];
              const preview = makeDay(role, n, 1);
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-xx text-sm font-black uppercase">Day {n}</span>
                    {rec ? (
                      <span className="font-xx rounded-[3px] bg-jacket px-1.5 text-xs font-black text-jacket-ink">{letter(rec.best)}</span>
                    ) : status !== "open" ? (
                      <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase text-muted">
                        <Lock className="h-3 w-3" /> {status === "pro" ? "Pro" : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted">{preview.weekday}</div>
                  <div className="font-x mt-2 font-extrabold leading-tight">{preview.title}</div>
                  <div className="mt-2 text-xs text-muted">{rec ? `Best ${Math.round(rec.best * 100)}% · ${fmtMetric(role, rec.metric)}` : `${preview.tasks.length} tasks`}</div>
                </>
              );
              const cls = "block h-full rounded-[8px] p-3 text-left transition-colors";
              return (
                <li key={n}>
                  {status === "open" ? (
                    <button onClick={() => onStart(n)} className={cn(cls, "w-full bg-surface-2 hover:bg-border", rec && "ring-2 ring-jacket")}>
                      {body}
                    </button>
                  ) : status === "pro" ? (
                    <Link href="/pricing" className={cn(cls, "bg-surface-2/60 opacity-70 hover:opacity-100")}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cn(cls, "bg-surface-2/60 opacity-50")} aria-disabled>
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <p className="text-center text-xs text-muted">Every replay is a new day: fresh numbers, same kind of work. Progress is saved in this browser.</p>
    </div>
  );
}

/* --------------------------------------------------------------------- day */

type Done = { score: number; answer: Answer; outcome: Outcome };

function DayRun({ day, pro, onLeave, onPlay }: { day: Day; pro: boolean; onLeave: () => void; onPlay: (n: number) => void }) {
  const [i, setI] = React.useState(0);
  const [done, setDone] = React.useState<Done[]>([]);
  const finish = useDesk((s) => s.finish);
  const over = done.length === day.tasks.length && i >= day.tasks.length;
  const metric = done.reduce((a, d) => a + d.outcome.delta, 0);
  const score = done.length ? done.reduce((a, d) => a + d.score, 0) / done.length : 0;
  const career = CAREERS[day.role];
  const task = day.tasks[Math.min(i, day.tasks.length - 1)];
  const answered = done.length > i;
  const top = React.useRef<HTMLDivElement>(null);

  const submit = (a: Answer) => {
    const s = grade(task.q, a);
    setDone((d) => [...d, { score: s, answer: a, outcome: task.outcome(a, s) }]);
  };
  const next = () => {
    if (i + 1 >= day.tasks.length) {
      const total = done.reduce((a, d) => a + d.score, 0) / done.length;
      finish(day.role, day.n, total, metric);
    }
    setI(i + 1);
    top.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div ref={top} className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-jacket px-6 py-5 text-jacket-ink shadow-(--shadow-card)">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">
            {career.title} · {LEVELS.find((l) => l.level === day.level)!.title} · {LEVEL_LABEL[day.level]}
          </p>
          <h2 className="font-xx mt-1 text-[1.9rem] font-black uppercase leading-none">
            Day {day.n} · {day.weekday}
          </h2>
          <p className="mt-1 font-bold opacity-90">{day.title}</p>
        </div>
        <button onClick={onLeave} className="font-x flex items-center gap-1.5 rounded-[4px] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.06em] opacity-80 hover:bg-black/15 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" /> Journey
        </button>
      </div>

      {over ? (
        <Recap day={day} done={done} metric={metric} score={score} pro={pro} onLeave={onLeave} onPlay={onPlay} />
      ) : (
        <>
          <Scoreboard
            cells={[
              { label: "Time", value: task.time },
              { label: "Task", value: `${i + 1}/${day.tasks.length}` },
              { label: career.metric, value: fmtMetric(day.role, metric), tone: metric > 0 ? "good" : metric < 0 ? "bad" : "hot" },
              { label: "Score", value: done.length ? `${Math.round(score * 100)}%` : "—" },
            ]}
          />
          <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <Timeline day={day} i={i} done={done} />
            <TaskCard key={i} task={task} role={day.role} result={answered ? done[i] : null} onSubmit={submit} onNext={next} nextLabel={i + 1 < day.tasks.length ? `Next: ${day.tasks[i + 1].time} · ${day.tasks[i + 1].title}` : "End of day"} />
          </div>
        </>
      )}
    </div>
  );
}

function Timeline({ day, i, done }: { day: Day; i: number; done: Done[] }) {
  return (
    <ol className="rounded-2xl bg-surface p-3 shadow-(--shadow-card) max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto">
      {day.tasks.map((t, k) => {
        const d = done[k];
        return (
          <li
            key={k}
            className={cn(
              "flex shrink-0 items-start gap-2.5 rounded-[6px] px-2.5 py-2",
              k === i && "bg-surface-2",
              k > i && "opacity-55",
            )}
          >
            <span
              className={cn(
                "font-xx mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6rem] font-black",
                d ? (d.score === 1 ? "bg-positive text-white" : d.score > 0 ? "bg-gold text-[#1a1300]" : "bg-negative text-white") : k === i ? "bg-jacket text-jacket-ink" : "bg-surface-2",
              )}
            >
              {d ? d.score === 1 ? <Check className="h-3 w-3" strokeWidth={4} /> : d.score > 0 ? <Minus className="h-3 w-3" strokeWidth={4} /> : <X className="h-3 w-3" strokeWidth={4} /> : k + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold tabular-nums text-muted">{t.time}</span>
              <span className="block text-sm font-bold leading-tight max-lg:hidden">{t.title}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------- task */

function TaskCard({
  task,
  role,
  result,
  onSubmit,
  onNext,
  nextLabel,
}: {
  task: Task;
  role: Role;
  result: Done | null;
  onSubmit: (a: Answer) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [value, setValue] = React.useState<Answer>(task.q.kind === "multi" ? [] : null);
  const q = task.q;
  const ready = q.kind === "multi" ? true : value !== null && value !== "";
  return (
    <article className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-(--jacket-text) px-5 py-3">
        <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
          {task.time} · {task.where}
        </span>
        <span className="font-x text-sm font-black">{task.title}</span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex gap-3">
          <span className="font-xx grid h-10 w-10 shrink-0 place-items-center rounded-full bg-jacket text-sm font-black text-jacket-ink">{task.from.name[0]}</span>
          <div className="min-w-0">
            <div className="text-sm">
              <strong>{task.from.name}</strong> <span className="text-muted">· {task.from.role}</span>
            </div>
            <p className="mt-1 rounded-[4px_14px_14px_14px] bg-surface-2 px-4 py-3 text-[0.95rem] leading-relaxed">{task.message}</p>
          </div>
        </div>

        {task.blocks.map((b, k) => (
          <BlockView key={k} b={b} />
        ))}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!result && ready) onSubmit(value);
          }}
        >
          <p className="font-x font-extrabold">{q.prompt}</p>
          {q.kind === "number" ? (
            <label className="flex items-center gap-2">
              {q.prefix && <span className="font-x text-lg font-black text-muted">{q.prefix}</span>}
              <input
                autoFocus
                inputMode="decimal"
                autoComplete="off"
                disabled={!!result}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
                aria-label={q.prompt}
                className="font-xx h-12 w-44 rounded-[6px] border-[1.5px] border-foreground bg-surface px-3 text-xl font-black tabular-nums outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
              />
              {q.unit && <span className="font-x font-extrabold text-muted">{q.unit}</span>}
            </label>
          ) : (
            <div className={cn("grid gap-2", q.options.some((o) => o.length > 40) ? "grid-cols-1" : "sm:grid-cols-2")}>
              {q.options.map((o) => {
                const chosen = q.kind === "multi" ? (value as string[]).includes(o) : value === o;
                const right = result && (q.kind === "multi" ? q.answer.includes(o) : (q.accept ?? [q.answer]).includes(o));
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={!!result}
                    aria-pressed={chosen}
                    onClick={() => setValue(q.kind === "multi" ? (chosen ? (value as string[]).filter((x) => x !== o) : [...(value as string[]), o]) : o)}
                    className={cn(
                      "rounded-[6px] px-4 py-3 text-left text-sm font-bold transition-colors disabled:cursor-default",
                      chosen ? "bg-jacket text-jacket-ink" : "bg-surface-2 hover:bg-border",
                      right && "ring-2 ring-positive",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}
          {!result && <ActionPlate tone="jacket" type="submit" disabled={!ready} label={q.kind === "multi" && !(value as string[]).length ? "None of them" : "Submit"} className="min-w-44" />}
        </form>

        {result && (
          <div className="space-y-3">
            <div className={cn("space-y-1.5 rounded-[8px] px-4 py-3 text-sm", result.score === 1 ? "bg-positive/12" : result.score > 0 ? "bg-(--hint-bg)" : "bg-negative/12")}>
              <p className="font-bold">
                {result.score === 1 ? "Right." : result.score > 0 ? "Close." : "Not quite."}{" "}
                {result.score < 1 && <span className="font-normal">Answer: <strong>{answerText(q)}</strong></span>}
              </p>
              {task.why.map((w, k) => (
                <p key={k}>{w}</p>
              ))}
            </div>
            <div className="flex items-start gap-3 rounded-[8px] bg-[#0f131a] px-4 py-3 text-sm text-white">
              <span className={cn("font-xx shrink-0 font-black tabular-nums", result.outcome.delta > 0 ? "text-[#5ee09a]" : result.outcome.delta < 0 ? "text-[#ff7c8a]" : "text-white/70")}>
                {fmtMetric(role, result.outcome.delta)}
              </span>
              <span className="text-white/85">{result.outcome.text}</span>
            </div>
            <ActionPlate tone="jacket" onClick={onNext} label={nextLabel} icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
          </div>
        )}
      </div>
    </article>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.kind === "text") return <p className="rounded-[6px] border-l-4 border-(--jacket-text) bg-surface-2 px-4 py-3 text-sm">{b.text}</p>;
  if (b.kind === "kv")
    return (
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {b.items.map(([k, v]) => (
          <div key={k} className="rounded-[6px] bg-surface-2 px-3 py-2.5">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted">{k}</dt>
            <dd className="font-x mt-0.5 font-black tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <div className="overflow-x-auto rounded-[6px] bg-surface-2 p-3">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-muted">
            {b.head.map((h, k) => (
              <th key={k} className="whitespace-nowrap px-2 pb-1.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, k) => (
            <tr key={k} className={cn("border-t border-border", b.mark === k && "bg-negative/12 font-bold")}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------- recap */

const NOTES: Record<Role, Record<string, string>> = {
  trader: {
    A: "Clean day. That's how a senior runs a book.",
    B: "Solid. A couple of sloppy moments, but the book's fine.",
    C: "You got through it. Tighten up the numbers before tomorrow's open.",
    D: "Rough one. Go through the working tonight; tomorrow's another open.",
  },
  researcher: {
    A: "That's the kind of rigour I can put money behind.",
    B: "Good work. Check the details before the next meeting.",
    C: "Some of this wouldn't survive a review. Re-read the working.",
    D: "I can't take this to the investment committee yet. Let's go through it tomorrow.",
  },
};

function Recap({ day, done, metric, score, pro, onLeave, onPlay }: { day: Day; done: Done[]; metric: number; score: number; pro: boolean; onLeave: () => void; onPlay: (n: number) => void }) {
  useRecordGame();
  const records = useDesk((s) => s.records);
  const g = letter(score);
  const boss = day.role === "trader" ? "Hugo, head of desk" : "Ivy, portfolio manager";
  const nextOpen = day.n < 15 && dayStatus(records, day.role, day.n + 1, pro) === "open";
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        <div className="flex flex-wrap items-end justify-between gap-6 bg-[#0f131a] px-6 py-7 text-white sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-60">End of day · {CAREERS[day.role].metric}</p>
            <p className={cn("font-xx mt-1 text-[3rem] font-black leading-none", metric > 0 ? "text-[#5ee09a]" : metric < 0 ? "text-[#ff7c8a]" : "")}>{fmtMetric(day.role, metric)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-60">Grade</p>
            <p className="font-xx text-[3rem] font-black leading-none text-gold">{g}</p>
            <p className="text-sm opacity-75">{Math.round(score * 100)}% right</p>
          </div>
        </div>
        <div className="space-y-4 p-6 sm:p-8">
          <blockquote className="rounded-[8px] border-l-4 border-(--jacket-text) bg-surface-2 px-4 py-3">
            <p className="text-[0.95rem]">&ldquo;{NOTES[day.role][g]}&rdquo;</p>
            <footer className="mt-1 text-xs font-bold text-muted">{boss}</footer>
          </blockquote>
          <ol className="divide-y divide-border">
            {day.tasks.map((t, k) => (
              <li key={k} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-12 shrink-0 font-bold tabular-nums text-muted">{t.time}</span>
                <span className="min-w-0 flex-1 font-bold">{t.title}</span>
                <span className={cn("font-x shrink-0 font-black tabular-nums", done[k].outcome.delta > 0 ? "text-positive" : done[k].outcome.delta < 0 ? "text-negative" : "text-muted")}>
                  {fmtMetric(day.role, done[k].outcome.delta)}
                </span>
                <span
                  className={cn(
                    "font-xx grid h-6 w-6 shrink-0 place-items-center rounded-full text-white",
                    done[k].score === 1 ? "bg-positive" : done[k].score > 0 ? "bg-gold text-[#1a1300]" : "bg-negative",
                  )}
                >
                  {done[k].score === 1 ? <Check className="h-3.5 w-3.5" strokeWidth={4} /> : done[k].score > 0 ? <Minus className="h-3.5 w-3.5" strokeWidth={4} /> : <X className="h-3.5 w-3.5" strokeWidth={4} />}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap justify-center gap-3 border-t border-border p-6">
          {nextOpen && <ActionPlate tone="jacket" onClick={() => onPlay(day.n + 1)} label={`Day ${day.n + 1}`} icon={<ArrowRight className="h-5 w-5" />} className="min-w-48" />}
          <ActionPlate tone="neutral" onClick={() => onPlay(day.n)} label="Replay this day" icon={<RotateCcw className="h-5 w-5" />} className="min-w-48" />
          <ActionPlate tone="neutral" onClick={onLeave} label="Journey" className="min-w-40" />
        </div>
        {!nextOpen && day.n < 15 && dayStatus(records, day.role, day.n + 1, pro) === "pro" && (
          <p className="pb-6 text-center text-sm text-muted">
            Day {day.n + 1} onwards needs{" "}
            <Link href="/pricing" className="font-bold text-foreground underline">
              Pro
            </Link>
            .
          </p>
        )}
      </section>
      <p className="text-center text-xs text-muted">
        {num(done.filter((d) => d.score === 1).length, 0)} of {done.length} tasks right. Replays bring new numbers.
      </p>
    </div>
  );
}
