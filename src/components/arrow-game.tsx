"use client";

import * as React from "react";
import {
  Play, RotateCcw, Flag, ArrowLeft, ArrowRight, Minus, X,
  Settings2, Trophy, Timer, Clock, Target, ShieldCheck,
} from "lucide-react";
import {
  ARROW_OPTIONS,
  DEFAULT_ARROW_CONFIG,
  GRID_COLS,
  isCorrect,
  keyToDir,
  makeTrials,
  summarize,
  type ArrowConfig,
  type CellKind,
  type Dir,
  type Response,
  type RoundLog,
  type Trial,
} from "@/lib/arrow-game";
import { cn } from "@/lib/utils";
import { Countdown } from "@/components/countdown";
import { useRecordGame } from "@/store/practice-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Phase = "intro" | "countdown" | "playing" | "over";

export function ArrowGame() {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [config, setConfig] = React.useState<ArrowConfig>(DEFAULT_ARROW_CONFIG);
  const [logs, setLogs] = React.useState<RoundLog[]>([]);

  const start = (cfg: ArrowConfig) => {
    setConfig(cfg);
    setLogs([]);
    setPhase("countdown");
  };

  const roundMs = config.roundSeconds * 1000;

  // Rounds are deliberately feedback-free (like the real test), so the only
  // state change worth speaking is the final summary.
  const s = phase === "over" ? summarize(logs, roundMs) : null;
  const status = s
    ? `Game over. Score ${s.score}. ${s.correct} of ${s.total} correct, ${(s.accuracy * 100).toFixed(0)}% accuracy. Held back on ${s.noGoCorrect} of ${s.noGoTotal} no-go rounds.`
    : "";

  const content =
    phase === "over" ? (
      <GameOver logs={logs} roundMs={roundMs} onAgain={() => setPhase("intro")} />
    ) : phase === "playing" ? (
      <Playing
        config={config}
        onEnd={(finalLogs) => {
          setLogs(finalLogs);
          setPhase("over");
        }}
      />
    ) : (
      <>
        <Intro saved={config} onStart={start} />
        {phase === "countdown" && <Countdown onDone={() => setPhase("playing")} />}
      </>
    );

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {content}
    </>
  );
}

/* ----------------------------------- intro --------------------------- */

function Intro({ saved, onStart }: { saved: ArrowConfig; onStart: (c: ArrowConfig) => void }) {
  const [config, setConfig] = React.useState<ArrowConfig>(saved);
  const set = <K extends keyof ArrowConfig>(k: K, v: ArrowConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));
  const totalSec = Math.round(config.rounds * config.roundSeconds);

  return (
    // Title and description live in the page header — this card is just setup.
    <Card className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-6 py-8">
        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented label="Rounds" options={ARROW_OPTIONS.rounds} value={config.rounds} onChange={(v) => set("rounds", v)} />
          <Segmented label="Seconds per round" options={ARROW_OPTIONS.roundSeconds} value={config.roundSeconds} onChange={(v) => set("roundSeconds", v)} suffix="s" />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-muted">Total time</span>
            <span className="font-mono font-semibold text-foreground">
              {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => onStart(config)}>
            <Play className="h-4 w-4" /> Start game
          </Button>
        </div>

        {/* Below the CTA on purpose — it's a supporting illustration, and it
            keeps the settings and Start button above the fold. */}
        <ExampleGrid />
      </CardContent>
    </Card>
  );
}

function ExampleGrid() {
  // Illustrates a "go" trial: react to the bright middle arrow, ignore the rest.
  const example: CellKind[] = [
    "left", "left", "left", "left", "left",
    "left", "left", "right", "left", "left",
    "left", "left", "left", "left", "left",
  ];
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-surface-2/40 p-4 text-center">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Example</div>
      <Grid grid={example} />
      <p className="mt-3 text-sm text-muted">
        Middle points <span className="font-semibold text-foreground">right</span> → press{" "}
        <Kbd>P</Kbd> / <Kbd>→</Kbd>. Ignore the surrounding arrows.
      </p>
    </div>
  );
}

function Segmented<T extends number>({
  label, options, value, onChange, suffix = "",
}: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-9 min-w-11 rounded-lg border px-3 font-mono text-sm transition-colors",
              value === opt ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- playing -------------------------- */

function Playing({ config, onEnd }: { config: ArrowConfig; onEnd: (logs: RoundLog[]) => void }) {
  const trials = React.useMemo<Trial[]>(() => makeTrials(config), [config]);
  const roundMs = config.roundSeconds * 1000;

  const [roundIdx, setRoundIdx] = React.useState(0);
  const [correctCount, setCorrectCount] = React.useState(0);
  const [pressed, setPressed] = React.useState<Dir | null>(null); // subtle "you pressed" cue only
  const [now, setNow] = React.useState(() => performance.now());

  const logsRef = React.useRef<RoundLog[]>([]);
  const roundStartRef = React.useRef(performance.now());
  const sessionStartRef = React.useRef(performance.now()); // fixed wall-clock start
  const committedRef = React.useRef(false); // guards against double-committing a round

  const trial = trials[roundIdx];

  // Finalise the current round and move on. Called either by a keypress
  // (response = the direction) or by the timeout firing (response = null).
  const commitRef = React.useRef<(response: Response, rt: number | null) => void>(() => {});
  commitRef.current = (response, rt) => {
    if (committedRef.current) return;
    committedRef.current = true;
    const ok = isCorrect(trial, response);
    logsRef.current.push({ trial, response, correct: ok, rtMs: response != null ? rt : null });
    if (ok) setCorrectCount((c) => c + 1);
    if (roundIdx + 1 >= trials.length) onEnd(logsRef.current);
    else setRoundIdx((i) => i + 1);
  };

  // A press ends the round immediately (only the first press counts).
  const record = React.useCallback((dir: Dir) => {
    if (committedRef.current) return;
    setPressed(dir);
    commitRef.current(dir, performance.now() - roundStartRef.current);
  }, []);

  // Each new round starts its clock; if nothing is pressed within roundSeconds
  // the round auto-advances with no response (no feedback, like the real test).
  React.useEffect(() => {
    roundStartRef.current = performance.now();
    committedRef.current = false;
    setPressed(null);
    const id = window.setTimeout(() => commitRef.current(null, null), roundMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx]);

  // Keyboard controls.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key);
      if (dir) {
        e.preventDefault();
        record(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record]);

  // Lightweight ticker for the countdown + round progress bar.
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 90);
    return () => window.clearInterval(id);
  }, []);

  const withinRound = Math.min(roundMs, now - roundStartRef.current);
  const roundProgress = withinRound / roundMs;
  // A steady wall-clock countdown of the total session budget — unaffected by
  // how fast you answer (answering early just ends the game sooner).
  const totalSec = trials.length * config.roundSeconds;
  const secondsLeft = Math.max(0, Math.round(totalSec - (now - sessionStartRef.current) / 1000));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Round" value={`${roundIdx + 1}/${trials.length}`} />
        <StatTile label="Correct" value={String(correctCount)} accent />
        <StatTile
          label="Time left"
          value={`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
        />
      </div>

      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* round progress */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-[width] duration-100 ease-linear"
              style={{ width: `${roundProgress * 100}%` }}
            />
          </div>

          <div className="mx-auto max-w-md">
            <Grid grid={trial.grid} />
          </div>

          {/* tap controls (also works with Q/P or ← / →) */}
          <div className="mx-auto flex max-w-md items-stretch gap-3">
            <TapButton dir="left" pressed={pressed === "left"} onPress={() => record("left")} />
            <TapButton dir="right" pressed={pressed === "right"} onPress={() => record("right")} />
          </div>
          <p className="text-center text-xs text-muted">
            Press <Kbd>Q</Kbd>/<Kbd>←</Kbd> for left, <Kbd>P</Kbd>/<Kbd>→</Kbd> for right. If the
            middle arrow is surrounded by <span className="font-mono text-foreground">✕</span>, press nothing.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => onEnd(logsRef.current)}>
          <Flag className="h-4 w-4" /> End game
        </Button>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="px-4 py-3 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className={cn("mt-0.5 font-mono text-2xl font-bold tabular-nums", accent && "text-accent")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TapButton({ dir, pressed, onPress }: { dir: Dir; pressed: boolean; onPress: () => void }) {
  const Icon = dir === "left" ? ArrowLeft : ArrowRight;
  return (
    <button
      onClick={onPress}
      aria-label={dir === "left" ? "Press left" : "Press right"}
      className={cn(
        "flex h-14 flex-1 items-center justify-center rounded-xl border text-lg font-semibold transition-colors",
        pressed
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface-2/40 text-foreground hover:border-foreground/25",
      )}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

/* ----------------------------------- grid ---------------------------- */

const CELL_ICON: Record<CellKind, typeof ArrowLeft> = {
  left: ArrowLeft,
  right: ArrowRight,
  dash: Minus,
  x: X,
};

function Grid({ grid }: { grid: CellKind[] }) {
  return (
    <div
      className="grid gap-2 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
    >
      {grid.map((kind, i) => {
        const Icon = CELL_ICON[kind];
        return (
          <div key={i} className="grid aspect-square place-items-center">
            <Icon className="h-6 w-6 text-foreground sm:h-8 sm:w-8" strokeWidth={2.25} />
          </div>
        );
      })}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}

/* --------------------------------- game over ------------------------- */

function GameOver({ logs, roundMs, onAgain }: { logs: RoundLog[]; roundMs: number; onAgain: () => void }) {
  useRecordGame();
  const s = summarize(logs, roundMs);
  const savedSec = s.savedMs / 1000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight">Score</h2>
            <div className="font-mono text-4xl font-bold">{s.score}</div>
            <div className="font-mono text-sm font-semibold text-muted">
              {s.correct}/{s.total} correct · {(s.accuracy * 100).toFixed(0)}% accuracy
            </div>
          </div>

          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric icon={Target} label="Accuracy" value={`${(s.accuracy * 100).toFixed(0)}%`} />
            <Metric icon={Clock} label="Time saved" value={`${savedSec.toFixed(1)}s`} />
            <Metric icon={Timer} label="Avg speed" value={s.avgRtMs != null ? `${s.avgRtMs}ms` : "—"} />
            <Metric icon={ShieldCheck} label="Inhibition" value={`${s.noGoCorrect}/${s.noGoTotal}`} />
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={onAgain}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-accent" />
      <div className="font-mono text-lg font-semibold">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
