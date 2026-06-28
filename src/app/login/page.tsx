"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, LogIn } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const supabase = React.useMemo(() => getBrowserClient(), []);

  const signIn = () =>
    supabase?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center">
      <Card className="obsidian-glow w-full">
        <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Activity className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">
              Quant<span className="text-accent">Prep</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to practice problems, play the market-making games, and save
              your progress across devices.
            </p>
          </div>

          {supabase ? (
            <Button size="lg" className="w-full" onClick={signIn}>
              <LogIn className="h-4 w-4" /> Sign in with Google
            </Button>
          ) : (
            <p className="text-sm text-muted">
              Sign-in isn&apos;t configured here, so the app runs without login.{" "}
              <Link href="/" className="text-accent">Go to the app →</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
