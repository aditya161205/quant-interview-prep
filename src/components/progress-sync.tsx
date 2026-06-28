"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { usePracticeStore } from "@/store/practice-store";

/**
 * Keeps the local progress store in sync with the user's row in Supabase.
 * No-ops entirely when Supabase isn't configured (app stays on local storage).
 */
export function ProgressSync() {
  const supabase = React.useMemo(() => getBrowserClient(), []);
  const userRef = React.useRef<User | null>(null);

  const push = React.useCallback(async () => {
    const user = userRef.current;
    if (!supabase || !user) return;
    const s = usePracticeStore.getState();
    await supabase.from("progress").upsert({
      user_id: user.id,
      solved: s.solved,
      bookmarked: s.bookmarked,
      activity: s.activity,
      games: s.games,
      updated_at: new Date().toISOString(),
    });
  }, [supabase]);

  // On sign-in, REPLACE local state with this user's own row (or empty for a
  // new account) so progress never bleeds across accounts in the same browser.
  React.useEffect(() => {
    if (!supabase) return;

    const applyUser = async (user: User | null) => {
      userRef.current = user;
      if (!user) return; // anonymous: leave local storage as-is, don't clear
      const { data } = await supabase
        .from("progress")
        .select("solved,bookmarked,activity,games")
        .eq("user_id", user.id)
        .maybeSingle();
      usePracticeStore.getState().setAll({
        solved: data?.solved ?? {},
        bookmarked: data?.bookmarked ?? {},
        activity: data?.activity ?? {},
        games: data?.games ?? 0,
      });
      await push(); // ensure the row exists for a brand-new account
    };

    supabase.auth.getUser().then(({ data }) => applyUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        userRef.current = null;
        usePracticeStore.getState().setAll({}); // clear so the next user starts fresh
        return;
      }
      applyUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, push]);

  // Debounced push on every local change.
  React.useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = usePracticeStore.subscribe(() => {
      if (!userRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(push, 800);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [supabase, push]);

  return null;
}
