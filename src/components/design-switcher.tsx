"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

/** Local-only comparison of the redesign candidates. Each version fixes its own light or dark scheme. */
const VERSIONS = [
  { id: "original", label: "Original", scheme: "dark" },
  { id: "pit", label: "Pit", scheme: "light" },
  { id: "board", label: "Board", scheme: "dark" },
  { id: "pad", label: "Pad", scheme: "light" },
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

/** Runs before first paint so a reload never flashes the original look. */
export const DESIGN_BOOT = `try{var q=new URLSearchParams(location.search).get("design");var d=q||localStorage.getItem("${KEY}")||"original";if(q)localStorage.setItem("${KEY}",q);document.documentElement.dataset.design=d}catch(e){}`;

/** Re-renders when the boot script or a click changes <html data-design>. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-design"] });
  return () => observer.disconnect();
}

export function DesignSwitcher() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const design = React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-design") ?? "original",
    () => null,
  );

  React.useEffect(() => {
    document.documentElement.setAttribute("data-section", sectionOf(pathname));
  }, [pathname]);

  const choose = (id: string, scheme: string) => {
    document.documentElement.setAttribute("data-design", id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
    setTheme(scheme);
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
