"use client";

import * as React from "react";
import { Check, Flag, RotateCcw, X } from "lucide-react";
import { fmt, isRight, makeQuestion, parseAnswer, type Level, type Question } from "@/lib/options-drill";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, QuietButton, Scoreboard, Segmented, Stat, Ticket, TimerBar, ToggleRow } from "@/components/pit/game-kit";
import { cn } from "@/lib/utils";

type Settings = { seconds: number; level: Level; penalty: boolean };
type Log = { q: Question; given: number | null; ok: boolean; ms: number };

export function OptionsDrill() {
  const [settings, setSettings] = React.useState<Settings>({ seconds: 120, level: 1, penalty: true });
  const [phase, setPhase] = React.useState<"intro" | "playing" | "over">("intro");
  const [logs, setLogs] = React.useState<Log[]>([]);
  useHideRulesWhile(phase === "playing");

  if (phase === "over") return <GameOver logs={logs} settings={settings} onAgain={() => setPhase("intro")} />;
  if (phase === "playing")
    return (
      <Playing
        settings={settings}
        onEnd={(l) => {
          setLogs(l);
          setPhase("over");
        }}
      />
    );
  return (
    <Ticket onStart={() => setPhase("playing")} startLabel="Start the clock">
      <Segmented label="Time" options={[60, 120, 180]} value={settings.seconds} onChange={(v) => setSettings({ ...settings, seconds: v })} suffix="s" />
      <Segmented label="Level" options={[1, 2, 3] as Level[]} value={settings.level} onChange={(v) => setSettings({ ...settings, level: v })} />
      <ToggleRow label="Wrong answers cost a point" checked={settings.penalty} onChange={(v) => setSettings({ ...settings, penalty: v })} />
    </Ticket>
  );
}

const scoreOf = (logs: Log[], penalty: boolean) => logs.reduce((a, l) => a + (l.ok ? 1 : l.given !== null && penalty ? -1 : 0), 0);

/* ----------------------------------------------------------------- playing */

function Playing({ settings, onEnd }: { settings: Settings; onEnd: (logs: Log[]) => void }) {
  const [q, setQ] = React.useState(() => makeQuestion(settings.level));
  const [input, setInput] = React.useState("");
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [left, setLeft] = React.useState(settings.seconds);
  const shownAt = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The clock reads these at the buzzer without restarting on every answer.
  const latest = React.useRef({ logs, onEnd });
  React.useEffect(() => {
    latest.current = { logs, onEnd };
  });

  React.useEffect(() => {
    shownAt.current = performance.now();
    inputRef.current?.focus();
  }, [q]);

  React.useEffect(() => {
    const end = Date.now() + settings.seconds * 1000;
    const id = window.setInterval(() => {
      const l = Math.max(0, (end - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(id);
        latest.current.onEnd(latest.current.logs);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [settings.seconds]);

  const commit = (given: number | null) => {
    setLogs((l) => [...l, { q, given, ok: given !== null && isRight(q, given), ms: performance.now() - shownAt.current }]);
    setInput("");
    setQ(makeQuestion(settings.level, q.topic));
  };

  const parsed = parseAnswer(input);
  const last = logs[logs.length - 1];
  let streak = 0;
  for (let i = logs.length - 1; i >= 0 && logs[i].ok; i--) streak++;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Scoreboard
        cells={[
          { label: "Score", value: scoreOf(logs, settings.penalty), tone: "hot" },
          { label: "Correct", value: `${logs.filter((l) => l.ok).length}/${logs.length}` },
          { label: "Streak", value: streak, tone: streak >= 5 ? "good" : undefined },
        ]}
        aside={
          <QuietButton onClick={() => onEnd(logs)} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> End
          </QuietButton>
        }
      />
      <TimerBar left={left} total={settings.seconds} label="Time left" />

      <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        <div className="border-b-[3px] border-jacket px-6 py-3">
          <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{q.topic}</span>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {q.facts.map((f) => (
              <div key={f.label} className="rounded-[6px] bg-surface-2 px-4 py-3">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">{f.label}</dt>
                <dd className="font-xx mt-1 text-lg font-black tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (parsed !== null) commit(parsed);
            }}
            className="space-y-3"
          >
            <label htmlFor="drill-answer" className="font-xx block text-2xl font-black">
              {q.ask}
            </label>
            <div className="flex gap-2">
              <input
                id="drill-answer"
                ref={inputRef}
                inputMode="decimal"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") commit(null);
                }}
                className="font-xx h-16 min-w-0 flex-1 rounded-[6px] border-[1.5px] border-foreground bg-surface px-4 text-3xl font-black tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
              <ActionPlate tone="jacket" type="submit" disabled={parsed === null} label="Enter" className="min-w-28" />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Enter to answer · Esc to skip</span>
              <button type="button" onClick={() => commit(null)} className="font-x font-extrabold uppercase tracking-[0.06em] hover:text-foreground">
                Skip
              </button>
            </div>
          </form>
        </div>
      </section>

      <div aria-live="polite" className="min-h-12">
        {last && <LastResult key={logs.length} log={last} />}
      </div>
    </div>
  );
}

function LastResult({ log }: { log: Log }) {
  const Icon = log.ok ? Check : X;
  return (
    <div className={cn("animate-pop flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm", log.ok ? "bg-positive/12" : "bg-negative/12")}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", log.ok ? "text-positive" : "text-negative")} strokeWidth={3} />
      <span>
        <strong>{log.ok ? "Right" : log.given === null ? "Skipped" : `You said ${fmt(log.given)}`}</strong>
        {!log.ok && (
          <>
            {" "}
            · answer {fmt(log.q.answer)} <span className="text-muted">· {log.q.why}</span>
          </>
        )}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- game over */

function GameOver({ logs, settings, onAgain }: { logs: Log[]; settings: Settings; onAgain: () => void }) {
  useRecordGame();
  const right = logs.filter((l) => l.ok);
  const answered = logs.filter((l) => l.given !== null);
  const avg = right.length ? right.reduce((a, l) => a + l.ms, 0) / right.length / 1000 : null;
  let best = 0;
  let run = 0;
  for (const l of logs) {
    run = l.ok ? run + 1 : 0;
    best = Math.max(best, run);
  }

  const topics = new Map<string, { n: number; ok: number }>();
  for (const l of logs) {
    const t = topics.get(l.q.topic) ?? { n: 0, ok: 0 };
    t.n++;
    if (l.ok) t.ok++;
    topics.set(l.q.topic, t);
  }
  const misses = logs.filter((l) => !l.ok);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title={`${right.length} right of ${logs.length}`}
        figure={scoreOf(logs, settings.penalty)}
        figureLabel={`Score · level ${settings.level}`}
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="Go again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Accuracy" value={answered.length ? `${Math.round((right.length / answered.length) * 100)}%` : "—"} />
          <Stat label="Avg time (right)" value={avg !== null ? `${avg.toFixed(1)}s` : "—"} />
          <Stat label="Best streak" value={best} />
          <Stat label="Skipped" value={logs.length - answered.length} />
        </div>
        {topics.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {[...topics].map(([t, s]) => (
              <span key={t} className="rounded-[4px] bg-surface-2 px-3 py-1.5 text-xs font-bold">
                {t} <span className={cn("ml-1 tabular-nums", s.ok === s.n ? "text-positive" : s.ok === 0 ? "text-negative" : "text-muted")}>{s.ok}/{s.n}</span>
              </span>
            ))}
          </div>
        )}
      </FinalBand>

      {misses.length > 0 && (
        <Panel title="Review" meta={<span className="text-xs text-muted">{misses.length} to look at</span>}>
          <ul className="-my-2 divide-y divide-border">
            {misses.map((l, i) => (
              <li key={i} className="grid gap-1 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:gap-4">
                <span className="font-x font-extrabold">{l.q.topic}</span>
                <span className="text-muted">
                  {l.q.facts.map((f) => `${f.label} ${f.value}`).join(" · ")}. {l.q.ask}
                  <br />
                  <span className="text-foreground">{l.q.why}</span>
                </span>
                <span className="tabular-nums sm:text-right">
                  <span className="text-negative line-through">{l.given === null ? "skip" : fmt(l.given)}</span>{" "}
                  <strong className="font-x">{fmt(l.q.answer)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
