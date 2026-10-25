"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DAYS_TO_UNLOCK_WEEK, LEVELS, type Role } from "@/lib/desk";

/** Your best run of each day of each career, kept in this browser. */
export interface DayRecord {
  best: number;
  runs: number;
  /** P&L or credibility on the best run. */
  metric: number;
}

interface DeskState {
  records: Record<string, DayRecord>;
  finish: (role: Role, n: number, score: number, metric: number) => void;
}

export const dayId = (role: Role, n: number) => `${role}:${n}`;

export const useDesk = create<DeskState>()(
  persist(
    (set) => ({
      records: {},
      finish: (role, n, score, metric) =>
        set((s) => {
          const prev = s.records[dayId(role, n)];
          const better = !prev || score > prev.best;
          return {
            records: {
              ...s.records,
              [dayId(role, n)]: { best: better ? score : prev.best, runs: (prev?.runs ?? 0) + 1, metric: better ? metric : prev.metric },
            },
          };
        }),
    }),
    { name: "quantprep-desk" },
  ),
);

/** Day 1 is free; each later day opens after the one before it; each week after three days of the week before. */
export function dayStatus(records: Record<string, DayRecord>, role: Role, n: number, pro: boolean): "open" | "locked" | "pro" {
  const week = LEVELS.find((l) => l.days.includes(n))!;
  const i = week.days.indexOf(n);
  if (i > 0 && !records[dayId(role, n - 1)]) return "locked";
  if (i === 0 && week.week > 1) {
    const before = LEVELS[week.week - 2].days.filter((d) => records[dayId(role, d)]).length;
    if (before < DAYS_TO_UNLOCK_WEEK) return "locked";
  }
  return n > 1 && !pro ? "pro" : "open";
}
