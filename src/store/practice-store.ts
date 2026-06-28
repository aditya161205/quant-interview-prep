"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Local date key, e.g. "2026-06-27". */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PracticeState {
  solved: Record<string, boolean>;
  bookmarked: Record<string, boolean>;
  activity: Record<string, number>; // dayKey → number of actions that day (heatmap)
  games: number; // games completed
  toggleSolved: (id: string) => void;
  toggleBookmark: (id: string) => void;
  recordGame: () => void;
  /** Merge server-stored progress in (used on sign-in). */
  load: (data: Partial<Pick<PracticeState, "solved" | "bookmarked" | "activity" | "games">>) => void;
}

const bump = (activity: Record<string, number>) => {
  const k = dayKey();
  return { ...activity, [k]: (activity[k] ?? 0) + 1 };
};

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      solved: {},
      bookmarked: {},
      activity: {},
      games: 0,
      toggleSolved: (id) =>
        set((s) => {
          const next = !s.solved[id];
          return {
            solved: { ...s.solved, [id]: next },
            // only count newly-solved as activity
            activity: next ? bump(s.activity) : s.activity,
          };
        }),
      toggleBookmark: (id) =>
        set((s) => ({ bookmarked: { ...s.bookmarked, [id]: !s.bookmarked[id] } })),
      recordGame: () => set((s) => ({ games: s.games + 1, activity: bump(s.activity) })),
      load: (data) =>
        set((s) => ({
          solved: { ...s.solved, ...(data.solved ?? {}) },
          bookmarked: { ...s.bookmarked, ...(data.bookmarked ?? {}) },
          activity: { ...s.activity, ...(data.activity ?? {}) },
          games: Math.max(s.games, data.games ?? 0),
        })),
    }),
    { name: "quantprep-practice" },
  ),
);

/** Records one completed game (call once when a game-over screen mounts). */
export function useRecordGame(): void {
  const record = usePracticeStore((s) => s.recordGame);
  useEffect(() => {
    record();
  }, [record]);
}

/** Avoids hydration mismatches: persisted values are only trusted on the client. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
