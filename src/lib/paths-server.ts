import "server-only";
import contentJson from "@/data/paths/content.json";
import answersJson from "@/data/paths/answers.json";
import gradingJson from "@/data/paths/grading.json";
import { getServerClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import type { Kind, Question, QuestionStatus, StepDetail, StepSummary, Task, TaskStatus, Track } from "@/lib/paths";

/*
 * The Paths curriculum (exported from quantpath/ by `npm run paths:build`) and each user's progress.
 * Answers and solutions stay on the server until earned; progress and saved code live in Supabase
 * (tables path_progress and path_code, see supabase/schema.sql), one row set per signed-in user.
 */

interface StepJson {
  id: string;
  title: string;
  summary: string;
  kind: Kind;
  lesson: string;
  questions: string[];
  problems: string[];
}
interface QuestionJson {
  id: string;
  type: Question["type"];
  prompt: string;
  choices: string[] | null;
  step: string;
}
interface ProblemJson {
  id: string;
  step: string;
  title: string;
  difficulty: string;
  libs: string[];
  description: string;
  hints: string[];
  starter: string;
  fn: string;
  timeout: number;
}
interface AnswerJson {
  type: Question["type"];
  answer?: number;
  tol?: number;
  display?: string;
  explanation?: string;
  choices?: string[];
}

const CONTENT = contentJson as unknown as {
  tracks: { id: string; title: string; tagline: string; steps: string[] }[];
  steps: Record<string, StepJson>;
  questions: Record<string, QuestionJson>;
  problems: Record<string, ProblemJson>;
};
const ANSWERS = answersJson as unknown as { questions: Record<string, AnswerJson>; solutions: Record<string, string> };
const GRADING = gradingJson as unknown as { files: Record<string, string>; modules: Record<string, string> };

export const isStep = (id: unknown): id is string => typeof id === "string" && id in CONTENT.steps;
export const isQuestion = (id: unknown): id is string => typeof id === "string" && id in CONTENT.questions;
export const isTask = (id: unknown): id is string => typeof id === "string" && id in CONTENT.problems;

// ---------------------------------------------------------------- storage

interface Progress {
  questions: Record<string, { status: QuestionStatus; attempts: number }>;
  problems: Record<string, { status: TaskStatus; attempts: number; solved_at?: string; revealed?: boolean }>;
  marks: Record<string, boolean>;
}

const empty = (): Progress => ({ questions: {}, problems: {}, marks: {} });

export interface Store {
  load(): Promise<Progress>;
  save(p: Progress): Promise<void>;
  code(ids: string[]): Promise<Record<string, string>>;
  saveCode(id: string, code: string): Promise<void>;
}

// Without Supabase (local development) progress lives in server memory: nothing touches the disk,
// and a restart starts fresh.
const memory = { progress: empty(), code: new Map<string, string>() };
const memoryStore: Store = {
  load: async () => structuredClone(memory.progress),
  save: async (p) => void (memory.progress = structuredClone(p)),
  code: async (ids) => Object.fromEntries(ids.filter((id) => memory.code.has(id)).map((id) => [id, memory.code.get(id)!])),
  saveCode: async (id, code) => void memory.code.set(id, code),
};

/** The signed-in user's store, or null when nobody is signed in. */
export async function getStore(): Promise<Store | null> {
  if (!supabaseEnabled) return memoryStore;
  const supabase = await getServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  return {
    async load() {
      const { data: row, error } = await supabase
        .from("path_progress")
        .select("questions, problems, marks")
        .eq("user_id", user.id)
        .maybeSingle();
      fail("load progress", error);
      return { ...empty(), ...(row ?? {}) } as Progress;
    },
    async save(p) {
      const { error } = await supabase
        .from("path_progress")
        .upsert({ user_id: user.id, ...p, updated_at: new Date().toISOString() });
      fail("save progress", error);
    },
    async code(ids) {
      if (!ids.length) return {};
      const { data: rows, error } = await supabase
        .from("path_code")
        .select("task_id, code")
        .eq("user_id", user.id)
        .in("task_id", ids);
      fail("load code", error);
      return Object.fromEntries((rows ?? []).map((r) => [r.task_id as string, r.code as string]));
    },
    async saveCode(id, code) {
      const { error } = await supabase
        .from("path_code")
        .upsert({ user_id: user.id, task_id: id, code, updated_at: new Date().toISOString() });
      fail("save code", error);
    },
  };
}

// ---------------------------------------------------------------- reads

const qDone = (s?: QuestionStatus) => s === "correct" || s === "gotit";

function summary(sid: string, p: Progress): StepSummary {
  const st = CONTENT.steps[sid];
  return {
    id: sid,
    title: st.title,
    summary: st.summary,
    kind: st.kind,
    read: Boolean(p.marks[`read:${sid}`]),
    n_q: st.questions.length,
    done_q: st.questions.filter((q) => qDone(p.questions[q]?.status)).length,
    n_p: st.problems.length,
    done_p: st.problems.filter((t) => p.problems[t]?.status === "solved").length,
  };
}

export function state(p: Progress): { tracks: Track[] } {
  return {
    tracks: CONTENT.tracks.map((t) => ({ id: t.id, title: t.title, tagline: t.tagline, steps: t.steps.map((s) => summary(s, p)) })),
  };
}

function formatNumber(x: number): string {
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return x.toExponential(5).replace(/\.?0+e/, "e");
  return String(Number(x.toPrecision(6)));
}

function reveal(qid: string): { answer?: string; explanation: string } {
  const a = ANSWERS.questions[qid];
  const shown =
    a.type === "choice" && a.choices && typeof a.answer === "number"
      ? a.choices[a.answer]
      : (a.display ?? (typeof a.answer === "number" ? formatNumber(a.answer) : undefined));
  return { answer: shown, explanation: a.explanation ?? "" };
}

function publicQuestion(qid: string, p: Progress): Question {
  const q = CONTENT.questions[qid];
  const rec = p.questions[qid];
  const status = rec?.status ?? "new";
  return {
    id: qid,
    type: q.type,
    prompt: q.prompt,
    step: q.step,
    step_title: CONTENT.steps[q.step].title,
    choices: q.choices,
    status,
    attempts: rec?.attempts ?? 0,
    ...(qDone(status) || status === "revealed" ? reveal(qid) : {}),
  };
}

export function step(sid: string, p: Progress): StepDetail {
  const st = CONTENT.steps[sid];
  return {
    ...summary(sid, p),
    lesson: st.lesson,
    questions: st.questions.map((q) => publicQuestion(q, p)),
    problems: st.problems.map((t) => ({
      id: t,
      title: CONTENT.problems[t].title,
      difficulty: CONTENT.problems[t].difficulty,
      status: p.problems[t]?.status ?? "new",
    })),
  };
}

export async function task(id: string, p: Progress, store: Store): Promise<Task> {
  const pr = CONTENT.problems[id];
  const rec = p.problems[id];
  const saved = (await store.code([id]))[id];
  return {
    id,
    step: pr.step,
    step_title: CONTENT.steps[pr.step].title,
    title: pr.title,
    difficulty: pr.difficulty,
    libs: pr.libs,
    description: pr.description,
    hints: pr.hints,
    starter: pr.starter,
    code: saved ?? pr.starter,
    status: rec?.status ?? "new",
    timeout: pr.timeout,
    solution: rec?.status === "solved" || rec?.revealed ? ANSWERS.solutions[id] : null,
    siblings: CONTENT.steps[pr.step].problems,
  };
}

/** What the browser needs to grade one step's tasks: the runner, data generators and the step's module. */
export function grading(sid: string) {
  return { files: { ...GRADING.files, [`content/${sid}.py`]: GRADING.modules[sid] } };
}

// ---------------------------------------------------------------- writes

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/;

/** "1/6", "0.1667", "12.5%" and "$1,000" all parse; a percentage may mean 0.125 or 12.5. */
function parseNumber(text: string): number[] | null {
  let s = text.trim().toLowerCase().replace(/[,$\s]/g, "");
  const pct = s.endsWith("%");
  s = s.replace(/%+$/, "");
  const parts = s.split("/");
  if (parts.length > 2 || !parts.every((x) => NUMBER.test(x)) || (parts.length === 2 && Number(parts[1]) === 0)) return null;
  const v = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(parts[0]);
  return pct ? [v / 100, v] : [v];
}

export function answer(qid: string, given: string, p: Progress) {
  const a = ANSWERS.questions[qid];
  let correct = false;
  let close = false;
  if (a.type === "number") {
    const values = parseNumber(given);
    if (!values) return { error: "Enter a number, a fraction like 1/6, or a percentage like 12.5%." };
    const target = a.answer ?? 0;
    const tol = a.tol ?? 0.005;
    const err = Math.min(...values.map((v) => Math.abs(v - target)));
    const bound = Math.max(tol * Math.abs(target), 1e-9);
    correct = err <= bound;
    close = !correct && tol > 0 && err <= 5 * bound;
  } else if (a.type === "choice") {
    correct = Number(given) === a.answer;
  } else {
    return { error: "Open questions are revealed, not answered." };
  }
  const rec = (p.questions[qid] ??= { status: "new", attempts: 0 });
  rec.attempts += 1;
  if (correct) rec.status = "correct";
  else if (rec.status === "new") rec.status = "wrong";
  return { correct, close, ...(correct ? reveal(qid) : {}) };
}

export function show(qid: string, p: Progress) {
  const rec = (p.questions[qid] ??= { status: "new", attempts: 0 });
  if (!qDone(rec.status)) rec.status = "revealed";
  return reveal(qid);
}

export function selfmark(qid: string, value: "gotit" | "review", p: Progress) {
  (p.questions[qid] ??= { status: "new", attempts: 0 }).status = value;
}

/** Records a graded run. Grading happens in the browser, so this trusts the reported counts. */
export function result(id: string, mode: "run" | "submit", passed: number, total: number, p: Progress): TaskStatus {
  const rec = (p.problems[id] ??= { status: "attempted", attempts: 0 });
  if (mode === "submit") {
    rec.attempts += 1;
    if (total > 0 && passed === total && rec.status !== "solved") {
      rec.status = "solved";
      rec.solved_at = new Date().toISOString();
    }
  }
  return rec.status;
}

export function revealSolution(id: string, p: Progress): string {
  (p.problems[id] ??= { status: "attempted", attempts: 0 }).revealed = true;
  return ANSWERS.solutions[id];
}
