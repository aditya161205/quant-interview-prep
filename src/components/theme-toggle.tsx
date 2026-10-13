"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/** Light / dark switch for the jacket bar. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // The theme is only known on the client; render a stable placeholder until then.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={mounted ? (dark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className="grid h-9 w-9 place-items-center rounded-[6px] transition hover:bg-jacket-ink/15"
    >
      {mounted ? dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" /> : <span className="h-4 w-4" />}
    </button>
  );
}
