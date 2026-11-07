"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/account-menu";
import { isFocusPage, SECTIONS } from "@/lib/nav";

/** The jacket: a full-width bar in the current section's colour. The current section wears its badge. */
export function Navbar() {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const focus = isFocusPage(pathname);

  return (
    <header className="sticky top-0 z-50 bg-jacket text-jacket-ink transition-colors duration-300">
      <div className="mx-auto flex min-h-16 max-w-[96rem] flex-wrap items-center gap-x-2 px-4 sm:flex-nowrap sm:gap-x-6 sm:px-6">
        <Link href="/" aria-label="QuantPrep home" className="flex h-16 shrink-0 items-center gap-2.5">
          <span className="font-code grid h-9 min-w-11 place-items-center rounded-[4px] bg-jacket-ink px-1.5 text-sm font-black tracking-[0.04em] text-jacket">
            QP
          </span>
          <span className="font-x text-lg font-extrabold tracking-[-0.01em]">QuantPrep</span>
        </Link>

        {!isLogin && !focus && (
          <nav aria-label="Main" data-main-nav className="order-last flex w-full justify-between gap-1 pb-3 sm:order-none sm:w-auto sm:min-w-0 sm:justify-start sm:pb-0">
            {SECTIONS.map((s) => {
              const active = s.owns.some((p) => pathname.startsWith(p));
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "font-x shrink-0 rounded-[4px] px-2 py-2 text-center text-xs font-extrabold uppercase transition-colors sm:px-3 sm:text-sm sm:tracking-[0.06em]",
                    active ? "bg-jacket-ink text-jacket" : "opacity-85 hover:bg-jacket-ink/15 hover:opacity-100",
                  )}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
        )}

        {!isLogin && (
          <div className="ml-auto shrink-0">
            <AccountMenu />
          </div>
        )}
      </div>
    </header>
  );
}
