export type Difficulty = "Easy" | "Medium" | "Hard";

/** Lightweight metadata shown in the list (no statement/answer/solution). */
export interface ProblemMeta {
  id: number;
  title: string;
  category: string;
  companies: string[];
  difficulty: string;
}

/** What the detail view receives (still no answer or solution). */
export interface ProblemDetail {
  id: number;
  title: string;
  statement: string;
  category: string;
  companies: string[];
  difficulty: string;
  hasAnswer: boolean;
  prevId: number | null;
  nextId: number | null;
}

export function splitCompanies(askedIn: string | null): string[] {
  if (!askedIn) return [];
  return askedIn
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse "1/2", "0.5", "-3", etc. into a number, or null if not numeric. */
export function parseNumeric(raw: string): number | null {
  const s = (raw ?? "").trim().replace(/[\s,]+/g, "");
  if (!s) return null;
  if (s.includes("/")) {
    const [a, b] = s.split("/");
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb) || nb === 0) return null;
    return na / nb;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isNumericAnswer(stored: string | null): boolean {
  return parseNumeric(stored ?? "") !== null;
}

/** Compare a user's answer (fraction or decimal up to 3 dp) to the stored one. */
export function answerMatches(userRaw: string, stored: string | null): boolean {
  const u = parseNumeric(userRaw);
  const a = parseNumeric(stored ?? "");
  if (u === null || a === null) return false;
  // Match at 3 decimal places (the user enters up to 3 digits).
  return Math.round(u * 1000) === Math.round(a * 1000);
}
