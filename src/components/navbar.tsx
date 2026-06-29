"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButton } from "@/components/auth-button";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/market-making", label: "Market Making" },
  { href: "/profile", label: "Profile" },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Activity className="h-4 w-4" />
      </span>
      <span className="tracking-tight">
        Quant<span className="text-accent">Prep</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 px-4 pt-3">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-2xl px-3 sm:px-4">
        <Brand />

        {!isLogin && (
          <>
            <nav className="hidden items-center gap-0.5 sm:flex">
              {links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                      active ? "bg-foreground text-background" : "text-muted hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <AuthButton />
              <ThemeToggle />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
