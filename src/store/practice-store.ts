"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Local date key, e.g. "2026-06-27". */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ServerProgress = Pick<PracticeState, "solved" | "bookmarked" | "activity" | "games">;

interface PracticeState {
  solved: Record<string, boolean>;
  bookmarked: Record<string, boolean>;
  activity: Record<string, number>; // dayKey → number of actions that day (heatmap)
  games: number; // games completed
  userId: string | null; // whose progress this local copy belongs to
  toggleSolved: (id: string) => void;
  toggleBookmark: (id: string) => void;
  recordGame: () => void;
  /**
   * Reconcile with the server on sign-in. Same user → MERGE (never lose
   * progress made in another tab); different user → REPLACE (no bleed).
   */
  applyServer: (userId: string, data: Partial<ServerProgress>) => void;
  /** Clear everything on sign-out so the next account starts fresh. */
  signOut: () => void;
}

const bump = (activity: Record<string, number>) => {
  const k = dayKey();
  return { ...activity, [k]: (activity[k] ?? 0) + 1 };
};

const unionBool = (a: Record<string, boolean> = {}, b: Record<string, boolean> = {}) => {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = out[k] || b[k];
  return out;
};
const unionMax = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = Math.max(out[k] ?? 0, b[k] ?? 0);
  return out;
};

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      solved: {},
      bookmarked: {},
      activity: {},
      games: 0,
      userId: null,
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
      applyServer: (userId, data) =>
        set((s) => {
          const sameUser = s.userId === userId;
          const base: ServerProgress = sameUser
            ? { solved: s.solved, bookmarked: s.bookmarked, activity: s.activity, games: s.games }
            : { solved: {}, bookmarked: {}, activity: {}, games: 0 };
          return {
            userId,
            solved: unionBool(base.solved, data.solved),
            bookmarked: unionBool(base.bookmarked, data.bookmarked),
            activity: unionMax(base.activity, data.activity),
            games: Math.max(base.games, data.games ?? 0),
          };
        }),
      signOut: () => set({ solved: {}, bookmarked: {}, activity: {}, games: 0, userId: null }),
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
