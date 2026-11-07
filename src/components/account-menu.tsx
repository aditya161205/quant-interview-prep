"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CreditCard, LogIn, LogOut, Moon, Sun, User as UserIcon, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";

const ITEM = "font-x flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-foreground transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

type Plan = { billing: boolean; pro: boolean };

/** Profile, plan, theme and sign in/out, behind one button at the end of the bar. */
export function AccountMenu() {
  const supabase = React.useMemo(() => getBrowserClient(), []);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = React.useState<User | null>(null);
  const [open, setOpen] = React.useState(false);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const planAsked = React.useRef(false);

  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Only ask for the plan once someone reaches for the menu, so ordinary page loads don't pay for it.
  const askPlan = () => {
    if (planAsked.current) return;
    planAsked.current = true;
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: Plan | null) => setPlan(p))
      .catch(() => {});
  };

  // Close on navigation, on a click elsewhere, and on Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const name = (user?.user_metadata?.name as string | undefined) ?? (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const dark = resolvedTheme === "dark";
  const planLabel = !plan || !plan.billing ? "Pricing" : plan.pro ? "Your plan" : "Get Pro";

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onPointerEnter={askPlan}
        onFocus={askPlan}
        onClick={() => {
          askPlan();
          setOpen((o) => !o);
        }}
        className="flex h-11 cursor-pointer items-center gap-1 rounded-full bg-jacket-ink/15 py-1 pl-1 pr-2 transition-colors hover:bg-jacket-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jacket-ink"
      >
        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-jacket-ink text-jacket">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : name ? (
            <span className="font-x text-base font-black">{name.charAt(0).toUpperCase()}</span>
          ) : (
            <UserRound aria-hidden className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
          )}
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="account-menu" className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl bg-surface py-1 shadow-(--shadow-card) ring-1 ring-border">
          {name && <p className="truncate border-b border-border px-4 py-3 text-sm font-semibold text-muted">{name}</p>}
          <Link href="/profile" className={ITEM}>
            <UserIcon className="h-4 w-4" /> Profile
          </Link>
          <Link href="/pricing" className={ITEM}>
            <CreditCard className="h-4 w-4" /> {planLabel}
          </Link>
          <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} className={ITEM}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Light mode" : "Dark mode"}
          </button>
          {supabase && (
            <div className="border-t border-border">
              {user ? (
                <button type="button" onClick={() => supabase.auth.signOut()} className={ITEM}>
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } })}
                  className={ITEM}
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
