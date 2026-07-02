// Arrow Game — an Arctic-Shores-style flanker / inhibition reaction test.
//
// A 3×5 grid of symbols flashes each round. You react only to the MIDDLE cell
// (centre row, 3rd column): press LEFT if it points ←, RIGHT if it points →,
// and ignore everything around it. The one exception: if the middle arrow is
// surrounded by X symbols, that's a NO-GO — you must press nothing.

export type Dir = "left" | "right";
export type CellKind = "left" | "right" | "dash" | "x";
export type Response = Dir | null; // null = no key pressed this round

export const GRID_COLS = 5;
export const GRID_ROWS = 3;
export const CENTER_INDEX = Math.floor((GRID_ROWS * GRID_COLS) / 2); // 7 → centre cell

export interface Trial {
  grid: CellKind[]; // 15 cells; grid[CENTER_INDEX] is the target
  center: Dir; // direction of the middle arrow
  isNoGo: boolean; // flankers are X → you must inhibit (press nothing)
}

export interface RoundLog {
  trial: Trial;
  response: Response;
  correct: boolean;
  rtMs: number | null; // reaction time, if a key was pressed
}

export interface ArrowConfig {
  rounds: number;
  roundSeconds: number;
  noGoChance: number; // fraction of trials whose flankers are X (no-go)
}

export const ARROW_OPTIONS = {
  rounds: [40, 80, 120],
  roundSeconds: [1.2, 1.5, 2],
} as const;

export const DEFAULT_ARROW_CONFIG: ArrowConfig = {
  rounds: 80,
  roundSeconds: 1.5,
  noGoChance: 0.2,
};

const randDir = (): Dir => (Math.random() < 0.5 ? "left" : "right");

/** Build one round: a centre arrow surrounded by arrows, dashes, or X flankers. */
export function makeTrial(cfg: ArrowConfig): Trial {
  const center = randDir();
  const isNoGo = Math.random() < cfg.noGoChance;

  // What fills the 14 surrounding cells.
  let flanker: () => CellKind;
  if (isNoGo) {
    flanker = () => "x";
  } else if (Math.random() < 0.55) {
    flanker = () => randDir(); // mixed arrows (congruent + incongruent)
  } else {
    flanker = () => "dash"; // neutral distractors
  }

  const grid: CellKind[] = Array.from({ length: GRID_ROWS * GRID_COLS }, () => flanker());
  grid[CENTER_INDEX] = center;
  return { grid, center, isNoGo };
}

export function makeTrials(cfg: ArrowConfig): Trial[] {
  return Array.from({ length: cfg.rounds }, () => makeTrial(cfg));
}

/** The response that scores as correct for a trial (null = press nothing). */
export function correctResponse(trial: Trial): Response {
  return trial.isNoGo ? null : trial.center;
}

export function isCorrect(trial: Trial, response: Response): boolean {
  return response === correctResponse(trial);
}

/** Map a keyboard event key to a direction, or null if it isn't a game key. */
export function keyToDir(key: string): Dir | null {
  const k = key.toLowerCase();
  if (k === "arrowleft" || k === "q" || k === "a") return "left";
  if (k === "arrowright" || k === "p" || k === "l") return "right";
  return null;
}

export interface ArrowSummary {
  total: number;
  correct: number;
  accuracy: number; // 0..1
  goTotal: number;
  goCorrect: number;
  noGoTotal: number;
  noGoCorrect: number; // successful inhibitions
  avgRtMs: number | null; // over correct go-trials that were answered
  score: number;
}

export function summarize(logs: RoundLog[]): ArrowSummary {
  const total = logs.length;
  const correct = logs.filter((l) => l.correct).length;
  const go = logs.filter((l) => !l.trial.isNoGo);
  const noGo = logs.filter((l) => l.trial.isNoGo);
  const goCorrect = go.filter((l) => l.correct).length;
  const noGoCorrect = noGo.filter((l) => l.correct).length;

  const rts = go.filter((l) => l.correct && l.rtMs != null).map((l) => l.rtMs as number);
  const avgRtMs = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;

  // Score rewards accuracy, with a small speed bonus on correct answered trials.
  const speedBonus = rts.reduce((s, rt) => s + Math.max(0, Math.round((1000 - rt) / 20)), 0);
  const score = correct * 10 + speedBonus;

  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    goTotal: go.length,
    goCorrect,
    noGoTotal: noGo.length,
    noGoCorrect,
    avgRtMs,
    score,
  };
}
