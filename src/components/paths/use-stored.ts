"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** A localStorage value, read without a hydration mismatch (null on the server and first paint). */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}
