"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/paths", label: "Paths" },
  { href: "/market-making", label: "Market Making" },
  { href: "/profile", label: "Profile" },
  { href: "/pricing", label: "Pricing" },
];

/** The jacket: a full-width bar in the current section's colour. The current page wears its badge. */
export function Navbar() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <header className="sticky top-0 z-50 bg-jacket text-jacket-ink transition-colors duration-300">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <Link href="/" className="flex h-16 items-center gap-2.5">
          <span className="font-xx grid h-9 min-w-11 place-items-center rounded-[4px] bg-jacket-ink px-1.5 text-sm font-black tracking-[0.04em] text-jacket">
            QP
          </span>
          <span className="font-x text-lg font-extrabold tracking-[-0.01em]">QuantPrep</span>
        </Link>

        {!isLogin && (
          <>
            <div className="ml-auto flex items-center gap-1.5 lg:order-3">
              <ThemeToggle />
              <AuthButton />
            </div>
            <nav
              aria-label="Main"
              className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-2 lg:mx-0 lg:w-auto lg:overflow-visible lg:px-0 lg:pb-0"
            >
              {links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "font-x shrink-0 rounded-[4px] px-3 py-2 text-xs font-extrabold uppercase tracking-[0.1em] transition-colors",
                      active ? "bg-jacket-ink text-jacket" : "opacity-80 hover:bg-jacket-ink/15 hover:opacity-100",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
