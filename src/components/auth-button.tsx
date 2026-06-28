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
  if (!ready) return <Loader2 className="h-4 w-4 animate-spin text-muted" />;

  if (!user) {
    return (
      <Button
        size="sm"
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
  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? "Account";

  return (
    <div className="flex items-center gap-2">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-7 w-7 rounded-full border border-border" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <Button variant="outline" size="sm" aria-label="Sign out" onClick={() => supabase.auth.signOut()} className="w-9 px-0">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
