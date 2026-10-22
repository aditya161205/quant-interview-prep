"use client";

import * as React from "react";
import { ArrowRight, Check, Flag, Minus, RotateCcw, X } from "lucide-react";
import { STRATEGIES, makeQuestion, makeQueue, score, type QType, type Question, type Strategy } from "@/lib/strategies";
import { useRecordGame } from "@/store/practice-store";
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, QuietButton, Scoreboard, Segmented, Stat, Ticket, ToggleRow } from "@/components/pit/game-kit";
import { PayoffChart, StrategyCard } from "@/components/strategies/strategy-card";
import { cn } from "@/lib/utils";

type Settings = { rounds: number; advanced: boolean };
type Played = { q: Question; points: number };

const TYPE_LABEL: Record<QType, string> = {
  curve: "Read the curve",
  greeks: "Greeks",
  usecase: "When to use it",
  legs: "Build it",
  risk: "Risk",
};

const deckOf = (s: Settings) => STRATEGIES.filter((x) => s.advanced || !x.advanced);
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

export function StrategyGame() {
  const [settings, setSettings] = React.useState<Settings>({ rounds: 20, advanced: false });
  const [phase, setPhase] = React.useState<"intro" | "playing" | "over">("intro");
  const [log, setLog] = React.useState<Played[]>([]);
  useHideRulesWhile(phase === "playing");

  if (phase === "over") return <GameOver log={log} onAgain={() => setPhase("intro")} />;
  if (phase === "playing")
    return (
      <Playing
        settings={settings}
        onEnd={(l) => {
          setLog(l);
          setPhase("over");
        }}
      />
    );
  return (
    <div className="space-y-6">
      <Ticket onStart={() => setPhase("playing")} startLabel="Start" countdown={false} note="Misses come back a few questions later, asked a different way.">
        <Segmented label="Questions" options={[10, 20, 30]} value={settings.rounds} onChange={(v) => setSettings({ ...settings, rounds: v })} />
        <ToggleRow label="Advanced strategies" checked={settings.advanced} onChange={(v) => setSettings({ ...settings, advanced: v })} />
      </Ticket>
      <Library />
    </div>
  );
}

/* ----------------------------------------------------------------- library */

function Library() {
  const [open, setOpen] = React.useState(STRATEGIES[0].id);
  const st = STRATEGIES.find((s) => s.id === open)!;
  return (
    <Panel title="Strategy library" meta={<span className="text-xs text-muted">{STRATEGIES.length} strategies · study before you play</span>}>
      <div className="flex flex-wrap gap-1.5">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            aria-pressed={open === s.id}
            onClick={() => setOpen(s.id)}
            className={cn(
              "font-x rounded-[4px] px-3 py-1.5 text-xs font-extrabold transition-colors",
              open === s.id ? "bg-jacket text-jacket-ink" : "bg-surface-2 hover:bg-border",
            )}
          >
            {s.name}
            {s.advanced && <span className="ml-1 opacity-60">·adv</span>}
          </button>
        ))}
      </div>
      <StrategyCard key={st.id} st={st} className="border-t border-border pt-5" />
    </Panel>
  );
}

/* ----------------------------------------------------------------- playing */

function Playing({ settings, onEnd }: { settings: Settings; onEnd: (log: Played[]) => void }) {
  const deck = React.useMemo(() => deckOf(settings), [settings]);
  const [queue, setQueue] = React.useState(() => makeQueue(deck, settings.rounds));
  const [i, setI] = React.useState(0);
  const [log, setLog] = React.useState<Played[]>([]);
  const [answer, setAnswer] = React.useState<string | string[] | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const item = queue[i];
  const st = deck.find((s) => s.id === item.id)!;
  const q = React.useMemo(() => makeQuestion(st, item.type, deck), [st, item.type, deck]);
  const points = log.reduce((a, l) => a + l.points, 0);
  let streak = 0;
  for (let k = log.length - 1; k >= 0 && log[k].points === 1; k--) streak++;

  const reveal = (a: string | string[]) => {
    const p = score(q, a);
    setAnswer(a);
    setRevealed(true);
    setLog((l) => [...l, { q, points: p }]);
    // A miss comes back three questions later, asked another way (unless it's already coming back).
    // Repeats add at most half again to the game, so a bad run still ends.
    if (p < 1 && queue.length < Math.round(settings.rounds * 1.5) && !queue.slice(i + 1).some((x) => x.id === st.id)) {
      const types: QType[] = ["curve", "greeks", "usecase", "legs", "risk"];
      const other = types.filter((t) => t !== item.type)[Math.floor(Math.random() * 4)];
      setQueue((qu) => [...qu.slice(0, i + 4), { id: st.id, type: other }, ...qu.slice(i + 4)]);
    }
  };
  const next = () => {
    if (i + 1 >= queue.length) return onEnd(log);
    setI(i + 1);
    setAnswer(null);
    setRevealed(false);
  };

  // Keys: 1–4 pick an option, Enter moves on.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (revealed && e.key === "Enter") next();
      const n = Number(e.key);
      if (!revealed && q.kind === "choice" && n >= 1 && n <= q.options.length) reveal(q.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Scoreboard
        cells={[
          { label: "Question", value: `${i + 1}/${queue.length}` },
          { label: "Score", value: fmt(points), tone: "hot" },
          { label: "Streak", value: streak, tone: streak >= 5 ? "good" : undefined },
        ]}
        aside={
          <QuietButton onClick={() => onEnd(log)} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> End
          </QuietButton>
        }
      />

      <section key={i} className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        <div className="border-b-[3px] border-jacket px-6 py-3">
          <span className="font-x text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{TYPE_LABEL[q.type]}</span>
        </div>
        <div className="space-y-5 p-6">
          <p className={cn("font-x font-extrabold", q.type === "usecase" ? "text-xl leading-snug" : "text-lg")}>
            {q.type === "usecase" ? `“${q.prompt}”` : q.prompt}
          </p>
          {q.type === "usecase" && <p className="-mt-3 text-sm text-muted">Which strategy fits?</p>}
          {q.type === "curve" && <PayoffChart st={st} />}
          {q.kind === "choice" ? (
            <Choices q={q} answer={answer as string | null} revealed={revealed} onPick={reveal} />
          ) : (
            <Grid q={q} revealed={revealed} onCheck={reveal} />
          )}
        </div>
      </section>

      {revealed && (
        <>
          <Verdict q={q} points={log[log.length - 1]?.points ?? 0} />
          <Panel>
            <StrategyCard st={st} />
          </Panel>
          <ActionPlate tone="jacket" onClick={next} label={i + 1 >= queue.length ? "See results" : "Next question"} sub="Enter" icon={<ArrowRight className="h-5 w-5" />} className="w-full" />
        </>
      )}
    </div>
  );
}

function Choices({ q, answer, revealed, onPick }: { q: Extract<Question, { kind: "choice" }>; answer: string | null; revealed: boolean; onPick: (a: string) => void }) {
  return (
    <div className={cn("grid gap-2", q.type === "legs" ? "grid-cols-1" : "sm:grid-cols-2")}>
      {q.options.map((o, k) => {
        const right = revealed && o === q.answer;
        const wrong = revealed && o === answer && o !== q.answer;
        return (
          <button
            key={o}
            disabled={revealed}
            onClick={() => onPick(o)}
            className={cn(
              "flex items-center gap-3 rounded-[6px] px-4 py-3 text-left text-sm font-bold transition-colors disabled:cursor-default",
              right ? "bg-positive text-white" : wrong ? "bg-negative text-white" : "bg-surface-2 hover:bg-border",
            )}
          >
            <span className={cn("font-xx grid h-6 w-6 shrink-0 place-items-center rounded-[3px] text-xs", right || wrong ? "bg-white/20" : "bg-surface")}>{k + 1}</span>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Grid({ q, revealed, onCheck }: { q: Extract<Question, { kind: "grid" }>; revealed: boolean; onCheck: (a: string[]) => void }) {
  const [picked, setPicked] = React.useState<string[]>([]);
  const done = picked.filter(Boolean).length === q.rows.length;
  return (
    <div className="space-y-3">
      {q.rows.map((row, r) => (
        <div key={row} className="flex flex-wrap items-center gap-2">
          <span className="font-x w-28 shrink-0 text-sm font-extrabold">{row}</span>
          {q.options.map((o) => {
            const on = picked[r] === o;
            const right = revealed && q.accept[r].includes(o);
            return (
              <button
                key={o}
                disabled={revealed}
                aria-pressed={on}
                onClick={() => setPicked((p) => Object.assign([...p], { [r]: o }))}
                className={cn(
                  "font-xx h-10 min-w-14 rounded-[4px] px-3 text-sm font-black transition-colors disabled:cursor-default",
                  on ? (revealed ? (right ? "bg-positive text-white" : "bg-negative text-white") : "bg-jacket text-jacket-ink") : "bg-surface-2 hover:bg-border",
                  right && !on && "ring-2 ring-positive",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      ))}
      {!revealed && <ActionPlate tone="jacket" disabled={!done} onClick={() => onCheck(picked)} label="Check" className="min-w-40" />}
    </div>
  );
}

function Verdict({ q, points }: { q: Question; points: number }) {
  const Icon = points === 1 ? Check : points > 0 ? Minus : X;
  return (
    <div className={cn("flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm", points === 1 ? "bg-positive/12" : points > 0 ? "bg-(--hint-bg)" : "bg-negative/12")}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", points === 1 ? "text-positive" : points > 0 ? "" : "text-negative")} strokeWidth={3} />
      <span>
        <strong>{points === 1 ? "Right." : points > 0 ? `Partly right (${Math.round(points * 100)}%).` : "Not quite."}</strong>{" "}
        {q.kind === "choice"
          ? points === 1
            ? `It's a ${q.strategy.name.toLowerCase()}.`
            : `The answer is ${q.answer}.`
          : `${q.rows.map((r, k) => `${r}: ${q.answer[k]}`).join(" · ")}.`}{" "}
        {points < 1 && <span className="text-muted">It will come back in a few questions.</span>}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- game over */

function GameOver({ log, onAgain }: { log: Played[]; onAgain: () => void }) {
  useRecordGame();
  const points = log.reduce((a, l) => a + l.points, 0);
  const right = log.filter((l) => l.points === 1).length;
  let best = 0;
  let run = 0;
  for (const l of log) {
    run = l.points === 1 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // Strategies you missed at least once, most-missed first.
  const misses = new Map<string, { st: Strategy; n: number }>();
  for (const l of log)
    if (l.points < 1) {
      const e = misses.get(l.q.strategy.id) ?? { st: l.q.strategy, n: 0 };
      e.n++;
      misses.set(l.q.strategy.id, e);
    }
  const review = [...misses.values()].sort((a, b) => b.n - a.n);
  const byType = (["curve", "greeks", "usecase", "legs", "risk"] as QType[]).map((t) => {
    const ls = log.filter((l) => l.q.type === t);
    return { t, n: ls.length, p: ls.reduce((a, l) => a + l.points, 0) };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <FinalBand
        title={`${right} of ${log.length} right`}
        figure={log.length ? `${Math.round((points / log.length) * 100)}%` : "—"}
        figureLabel="Score"
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {byType.map((b) => (
            <Stat key={b.t} label={TYPE_LABEL[b.t]} value={b.n ? `${fmt(b.p)}/${b.n}` : "—"} ok={b.n ? b.p === b.n : undefined} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Best streak" value={best} />
          <Stat label="To review" value={review.length} ok={review.length === 0} />
        </div>
      </FinalBand>

      {review.length > 0 && (
        <Panel title="Review these" meta={<span className="text-xs text-muted">Missed at least once</span>}>
          <div className="-my-2 divide-y divide-border">
            {review.map(({ st, n }) => (
              <details key={st.id} className="group py-3">
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="font-x font-extrabold">{st.name}</span>
                  <span className="text-xs text-muted">missed {n}×</span>
                </summary>
                <StrategyCard st={st} className="pt-4" />
              </details>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
