"use client";

import * as React from "react";
import { RotateCcw, Flag, ArrowLeft, ArrowRight, Minus, X } from "lucide-react";
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
import { useHideRulesWhile } from "@/components/how-to-play";
import { ActionPlate, FinalBand, Panel, QuietButton, Scoreboard, Segmented, Stat, Ticket } from "@/components/pit/game-kit";

type Phase = "intro" | "countdown" | "playing" | "over";

export function ArrowGame() {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [config, setConfig] = React.useState<ArrowConfig>(DEFAULT_ARROW_CONFIG);
  const [logs, setLogs] = React.useState<RoundLog[]>([]);
  useHideRulesWhile(phase === "playing");

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
  const set = <K extends keyof ArrowConfig>(k: K, v: ArrowConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const totalSec = Math.round(config.rounds * config.roundSeconds);

  return (
    <div className="space-y-6">
      <Ticket
        onStart={() => onStart(config)}
        countdown={false}
        note={
          <span>
            Total time{" "}
            <strong className="font-x text-foreground">
              {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}
            </strong>
          </span>
        }
      >
        <Segmented label="Rounds" options={ARROW_OPTIONS.rounds} value={config.rounds} onChange={(v) => set("rounds", v)} />
        <Segmented label="Seconds per round" options={ARROW_OPTIONS.roundSeconds} value={config.roundSeconds} onChange={(v) => set("roundSeconds", v)} suffix="s" />
      </Ticket>
      <ExampleGrid />
    </div>
  );
}

function ExampleGrid() {
  // Illustrates a "go" trial: react to the middle arrow, ignore the rest.
  const example: CellKind[] = ["left", "left", "left", "left", "left", "left", "left", "right", "left", "left", "left", "left", "left", "left", "left"];
  return (
    <Panel title="Example" className="mx-auto max-w-3xl">
      <div className="mx-auto max-w-md">
        <Grid grid={example} />
      </div>
      <p className="text-center text-sm text-muted">
        The middle arrow points <strong className="text-foreground">right</strong>: press <Kbd>P</Kbd> or <Kbd>→</Kbd>. Ignore
        the arrows around it.
      </p>
    </Panel>
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
    <div className="space-y-5">
      <Scoreboard
        cells={[
          { label: "Round", value: `${roundIdx + 1}/${trials.length}` },
          { label: "Correct", value: correctCount, tone: "hot" },
          { label: "Time left", value: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` },
        ]}
        aside={
          <QuietButton onClick={() => onEnd(logsRef.current)} className="text-white/70 hover:bg-white/10 hover:text-white">
            <Flag className="h-4 w-4" /> End
          </QuietButton>
        }
      />

      <section className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        {/* round progress */}
        <div className="h-2 bg-surface-2">
          <div className="h-full bg-jacket transition-[width] duration-100 ease-linear" style={{ width: `${roundProgress * 100}%` }} />
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          <div className="mx-auto max-w-sm">
            <Grid grid={trial.grid} />
          </div>
          {/* tap controls (also works with Q/P or ← / →) */}
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
            <TapButton dir="left" pressed={pressed === "left"} onPress={() => record("left")} />
            <TapButton dir="right" pressed={pressed === "right"} onPress={() => record("right")} />
          </div>
          <p className="text-center text-xs text-muted">
            <Kbd>Q</Kbd>/<Kbd>←</Kbd> left · <Kbd>P</Kbd>/<Kbd>→</Kbd> right · middle arrow boxed in by ✕: press nothing
          </p>
        </div>
      </section>
    </div>
  );
}

function TapButton({ dir, pressed, onPress }: { dir: Dir; pressed: boolean; onPress: () => void }) {
  const Icon = dir === "left" ? ArrowLeft : ArrowRight;
  return (
    <button
      onClick={onPress}
      aria-label={dir === "left" ? "Press left" : "Press right"}
      className={cn(
        "flex h-20 items-center justify-center rounded-[8px] transition-colors active:scale-[0.98]",
        pressed ? "bg-jacket text-jacket-ink" : "bg-foreground text-background hover:bg-foreground/85",
      )}
    >
      <Icon className="h-9 w-9" strokeWidth={2.5} />
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
    <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}>
      {grid.map((kind, i) => {
        const Icon = CELL_ICON[kind];
        return (
          <div key={i} className="grid aspect-square place-items-center rounded-[6px] bg-surface-2">
            <Icon className="h-6 w-6 text-foreground sm:h-7 sm:w-7" strokeWidth={2.5} />
          </div>
        );
      })}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-x rounded-[3px] bg-foreground px-1.5 py-0.5 text-xs font-extrabold text-background">{children}</kbd>;
}

/* --------------------------------- game over ------------------------- */

function GameOver({ logs, roundMs, onAgain }: { logs: RoundLog[]; roundMs: number; onAgain: () => void }) {
  useRecordGame();
  const s = summarize(logs, roundMs);
  const savedSec = s.savedMs / 1000;

  return (
    <div className="mx-auto max-w-4xl">
      <FinalBand
        title={`${s.correct}/${s.total} correct`}
        figure={s.score}
        figureLabel="Score"
        actions={<ActionPlate tone="jacket" onClick={onAgain} label="Play again" icon={<RotateCcw className="h-5 w-5" />} className="min-w-56" />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Accuracy" value={`${(s.accuracy * 100).toFixed(0)}%`} />
          <Stat label="Time saved" value={`${savedSec.toFixed(1)}s`} />
          <Stat label="Avg speed" value={s.avgRtMs != null ? `${s.avgRtMs}ms` : "—"} />
          <Stat label="Held back" value={`${s.noGoCorrect}/${s.noGoTotal}`} />
        </div>
      </FinalBand>
    </div>
  );
}
