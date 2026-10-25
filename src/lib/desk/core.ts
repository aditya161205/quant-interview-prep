/**
 * The Desk: a day in the life of a quant trader or researcher. A day is a run of timed tasks, each a message
 * from a colleague with data to read, one decision to make, the working, and a consequence for the day.
 * Numbers are generated from a seed, so every replay is a new day.
 */

export type Role = "trader" | "researcher";
export type Level = "easy" | "medium" | "hard";

export interface Person {
  name: string;
  role: string;
}

export type Block =
  | { kind: "text"; text: string }
  | { kind: "kv"; items: [string, string][] }
  | { kind: "table"; head: string[]; rows: string[][]; mark?: number };

export type Q =
  | { kind: "number"; prompt: string; unit?: string; prefix?: string; answer: number; tol: number }
  | { kind: "choice"; prompt: string; options: string[]; answer: string; accept?: string[] }
  | { kind: "multi"; prompt: string; options: string[]; answer: string[] };

export type Answer = number | string | string[] | null;

export interface Outcome {
  /** Dollars for a trader, credibility points for a researcher. */
  delta: number;
  text: string;
}

export interface Task {
  time: string;
  where: string;
  from: Person;
  title: string;
  message: string;
  blocks: Block[];
  q: Q;
  why: string[];
  outcome: (a: Answer, score: number) => Outcome;
}

export interface Day {
  role: Role;
  n: number;
  level: Level;
  title: string;
  weekday: string;
  tasks: Task[];
}

/* ------------------------------------------------------------------ random */

export interface Rng {
  next: () => number;
  range: (lo: number, hi: number, step?: number) => number;
  pick: <T>(xs: readonly T[]) => T;
  sign: () => 1 | -1;
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo: number, hi: number, step = 1) => round(lo + Math.floor(next() * (Math.round((hi - lo) / step) + 1)) * step, 6);
  return { next, range, pick: (xs) => xs[Math.floor(next() * xs.length)], sign: () => (next() < 0.5 ? 1 : -1) };
}

/* ----------------------------------------------------------------- numbers */

export const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;
export const money = (x: number, dp = 0) => `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const signedMoney = (x: number, dp = 0) => `${x > 0 ? "+" : ""}${money(x, dp)}`;
export const num = (x: number, dp = 2) => `${x < 0 ? "−" : ""}${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const pct = (x: number, dp = 1) => `${num(x * 100, dp)}%`;

function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}
export const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
/** Inverse of the normal CDF, by bisection (plenty for teaching numbers). */
export function normInv(p: number): number {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ----------------------------------------------------------------- grading */

/** 1 right, 0.5 close, 0 wrong. */
export function grade(q: Q, a: Answer): number {
  if (q.kind === "number") {
    const x = typeof a === "string" ? parseFloat(a.replace(/[,$%\s]/g, "").replace(/[−–]/g, "-")) : a;
    if (typeof x !== "number" || !Number.isFinite(x)) return 0;
    const d = Math.abs(x - q.answer);
    return d <= q.tol ? 1 : d <= 2 * q.tol ? 0.5 : 0;
  }
  if (q.kind === "choice") return typeof a === "string" && (q.accept ?? [q.answer]).includes(a) ? 1 : 0;
  const C = new Set(q.answer);
  const G = new Set(Array.isArray(a) ? a : []);
  const union = new Set([...C, ...G]).size;
  if (union === 0) return 1;
  const inter = [...C].filter((x) => G.has(x)).length;
  return inter === union ? 1 : inter / union >= 0.5 ? 0.5 : 0;
}

export const answerText = (q: Q): string =>
  q.kind === "number" ? `${q.prefix ?? ""}${num(q.answer, Number.isInteger(q.answer) ? 0 : 2)}${q.unit ?? ""}` : q.kind === "choice" ? q.answer : q.answer.join(" · ") || "None of them";

/** A consequence sized by how well you did: the full win when right, half when close, a loss when wrong. */
export const stake = (win: number, loss: number, right: string, wrong: string) => (_: Answer, s: number): Outcome =>
  s === 1 ? { delta: win, text: right } : s > 0 ? { delta: Math.round(win * 0.3), text: right } : { delta: -loss, text: wrong };

/* ------------------------------------------------------------------ the career */

export const LEVELS: { level: Level; week: number; title: string; days: number[] }[] = [
  { level: "easy", week: 1, title: "Junior", days: [1, 2, 3, 4, 5] },
  { level: "medium", week: 2, title: "Associate", days: [6, 7, 8, 9, 10] },
  { level: "hard", week: 3, title: "Senior", days: [11, 12, 13, 14, 15] },
];
export const levelOf = (n: number): Level => (n <= 5 ? "easy" : n <= 10 ? "medium" : "hard");
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
/** A week opens once you've finished this many days of the week before. */
export const DAYS_TO_UNLOCK_WEEK = 3;
