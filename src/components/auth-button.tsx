"use client";

import * as React from "react";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AuthButton() {
  const supabase = React.useMemo(() => getBrowserClient(), []);
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Supabase not configured → no auth UI (app still works on local storage).
  if (!supabase) return null;
  if (!ready) return <Loader2 className="h-4 w-4 animate-spin opacity-70" />;

  if (!user) {
    return (
      <Button
        size="sm"
        className="bg-jacket-ink text-jacket shadow-none"
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
          })
        }
      >
        <LogIn className="h-4 w-4" /> Sign in
      </Button>
    );
  }

  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const name =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Account";

  return (
    <div className="flex items-center gap-2">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-8 w-8 rounded-[4px] ring-2 ring-jacket-ink/40" />
      ) : (
        <span className="font-x grid h-8 w-8 place-items-center rounded-[4px] bg-jacket-ink text-sm font-black text-jacket">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-[9rem] truncate text-sm font-semibold opacity-85 2xl:inline">{name}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex h-9 items-center gap-1.5 rounded-[6px] px-2.5 text-sm font-bold opacity-85 transition hover:bg-jacket-ink/15 hover:opacity-100"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden 2xl:inline">Sign out</span>
      </button>
    </div>
  );
}
