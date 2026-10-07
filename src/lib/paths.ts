/** Types and client helpers for the Paths section (API: src/app/api/paths/[action]/route.ts). */
export type Kind = "foundation" | "core" | "project" | "capstone" | "interview";

export const KIND_LABEL: Record<Kind, string> = {
  foundation: "Foundation",
  core: "Core",
  project: "Project lab",
  capstone: "Capstone",
  interview: "Interview",
};

export interface StepSummary {
  id: string;
  locked: boolean;
  title: string;
  summary: string;
  kind: Kind;
  read: boolean;
  n_q: number;
  done_q: number;
  n_p: number;
  done_p: number;
}

export interface Track {
  id: string;
  title: string;
  tagline: string;
  steps: StepSummary[];
}

export interface PathsState {
  tracks: Track[];
}

export type QuestionStatus = "new" | "wrong" | "correct" | "revealed" | "gotit" | "review";

export interface Question {
  id: string;
  type: "number" | "choice" | "open";
  prompt: string;
  step: string;
  step_title: string;
  choices: string[] | null;
  status: QuestionStatus;
  attempts: number;
  answer?: string;
  explanation?: string;
}

export type TaskStatus = "new" | "attempted" | "solved";

export interface TaskRow {
  id: string;
  title: string;
  difficulty: string;
  status: TaskStatus;
}

export interface StepDetail extends StepSummary {
  lesson: string;
  questions: Question[];
  problems: TaskRow[];
}

export interface Task {
  id: string;
  step: string;
  step_title: string;
  title: string;
  difficulty: string;
  libs: string[];
  description: string;
  hints: string[];
  starter: string;
  code: string;
  status: TaskStatus;
  timeout: number;
  solution: string | null;
  siblings: string[];
}

export interface CaseResult {
  name: string;
  sample: boolean;
  ok: boolean;
  seconds: number;
  message?: string;
  got?: string;
  expected?: string;
}

export interface RunResult {
  total?: number;
  passed?: number;
  cases?: CaseResult[];
  seconds?: number;
  error?: string;
  stdout?: string;
  figures?: string[];
  status?: TaskStatus;
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(
    `/api/paths/${path}`,
    body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error("Your session has expired. Sign in again.");
  if (!r.ok) throw new Error(data.error ? String(data.error) : `Request failed (HTTP ${r.status})`);
  return data as T;
}

/** Fraction of a step completed: the lesson, its questions and its coding tasks. */
export const stepPct = (s: StepSummary) => (Number(s.read) + s.done_q + s.done_p) / (1 + s.n_q + s.n_p);

export function trackPct(t: Track): number {
  const done = t.steps.reduce((x, s) => x + Number(s.read) + s.done_q + s.done_p, 0);
  const all = t.steps.reduce((x, s) => x + 1 + s.n_q + s.n_p, 0);
  return all ? done / all : 0;
}

export const nextStep = (t: Track) => t.steps.find((s) => stepPct(s) < 1) ?? t.steps[0];

/** The path a step belongs to (foundation steps are in both; prefer the one you came from). */
export function trackFor(state: PathsState, stepId: string, preferred?: string | null): Track | undefined {
  const own = state.tracks.find((t) => t.id === preferred && t.steps.some((s) => s.id === stepId));
  return own ?? state.tracks.find((t) => t.steps.some((s) => s.id === stepId));
}
