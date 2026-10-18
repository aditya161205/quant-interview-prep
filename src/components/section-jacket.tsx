"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Which jacket the current page wears (see the section rules in globals.css). */
export function sectionOf(path: string): string {
  if (path.startsWith("/practice")) return "practice";
  if (path.startsWith("/paths")) return "paths";
  if (path.startsWith("/market-making")) return "games";
  if (path.startsWith("/poker")) return "poker";
  if (path === "/" || path === "/login") return "home";
  return "account";
}

export function SectionJacket() {
  const pathname = usePathname();
  React.useEffect(() => {
    document.documentElement.setAttribute("data-section", sectionOf(pathname));
  }, [pathname]);
  return null;
}
