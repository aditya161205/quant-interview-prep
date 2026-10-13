"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

/** Local-only comparison of the redesign candidates. Each version fixes its own light or dark scheme. */
const VERSIONS = [
  { id: "original", label: "Original", scheme: "dark" },
  { id: "pit", label: "Pit", scheme: "light" },
  { id: "board", label: "Board", scheme: "dark" },
  { id: "pad", label: "Pad", scheme: "light" },
  { id: "metro", label: "Metro", scheme: "light" },
  { id: "slate", label: "Slate", scheme: "dark" },
  { id: "desk", label: "Desk", scheme: "dark" },
] as const;

const KEY = "qp-design";

/** Which part of the site a path belongs to; the Pit version colours the shell by it. */
function sectionOf(path: string): string {
  if (path.startsWith("/practice")) return "practice";
  if (path.startsWith("/paths")) return "paths";
  if (path.startsWith("/market-making")) return "games";
  if (path === "/") return "home";
  return "account";
}

/** A ?design= link sets the cookie the server renders from, then reloads once so the layout matches. */
export const DESIGN_BOOT = `try{var q=new URLSearchParams(location.search).get("design");if(q&&document.documentElement.dataset.design!==q){document.cookie="${KEY}="+q+";path=/;max-age=31536000";location.reload()}}catch(e){}`;

/** The server renders from this cookie; the attribute restyles the page before the refresh lands. */
function remember(id: string) {
  document.cookie = `${KEY}=${id};path=/;max-age=31536000`;
  document.documentElement.setAttribute("data-design", id);
}

/** Re-renders when the boot script or a click changes <html data-design>. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-design"] });
  return () => observer.disconnect();
}

/** The design candidate in use, for client components that render a different structure per version. */
export function useDesign(): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-design") ?? "original",
    () => null,
  );
}

export function DesignSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const design = useDesign();

  React.useEffect(() => {
    document.documentElement.setAttribute("data-section", sectionOf(pathname));
  }, [pathname]);

  const choose = (id: string, scheme: string) => {
    remember(id);
    setTheme(scheme);
    router.refresh(); // the server renders the version's own layout
  };

  return (
    <div role="radiogroup" aria-label="Design version" className="design-switcher">
      {VERSIONS.map((v) => (
        <button
          key={v.id}
          role="radio"
          aria-checked={design === v.id}
          onClick={() => choose(v.id, v.scheme)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
