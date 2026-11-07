"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isFocusPage } from "@/lib/nav";

/** A quiet way to find pricing that's always there, away from the main bar. */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/login" || isFocusPage(pathname)) return null;
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-5 text-sm text-muted sm:px-6">
        <span className="font-x font-bold">QuantPrep</span>
        <Link href="/pricing" className="font-semibold hover:text-foreground hover:underline">
          Pricing
        </Link>
      </div>
    </footer>
  );
}
