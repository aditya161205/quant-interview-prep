"use client";

import * as React from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";

/** Sign-in on the trading floor: the whole page is the green jacket. */
export default function LoginPage() {
  const supabase = React.useMemo(() => getBrowserClient(), []);

  const signIn = () =>
    supabase?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  return (
    <section className="full-bleed -mb-16 grid min-h-[calc(100vh-4rem)] place-items-center bg-jacket px-4 py-16 text-jacket-ink">
      <div className="w-full max-w-3xl">
        <span className="font-xx inline-grid h-14 min-w-20 place-items-center rounded-[4px] bg-jacket-ink px-3 text-2xl font-black text-jacket">
          QP
        </span>
        <h1 className="font-xx mt-8 text-[2.6rem] font-black uppercase leading-[0.9] tracking-[-0.03em] sm:text-[4.6rem]">
          Get on the floor
        </h1>
        <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed opacity-90">
          Sign in to practise interview problems, work through the trader and researcher paths, play the market-making
          games and keep your progress on every device.
        </p>
        {supabase ? (
          <button
            onClick={signIn}
            className="font-x mt-9 inline-flex h-13 items-center gap-2.5 rounded-[6px] bg-jacket-ink px-8 text-lg font-bold text-jacket transition hover:brightness-95"
          >
            <LogIn className="h-5 w-5" /> Sign in with Google
          </button>
        ) : (
          <p className="mt-9 text-sm opacity-90">
            Sign-in isn&apos;t configured here, so the app runs without an account.{" "}
            <Link href="/" className="font-bold underline underline-offset-4">
              Go to the app →
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
