"use client";

import * as React from "react";

/**
 * Full-screen 3-2-1 countdown shown after a player hits "Start", before the
 * game actually begins. Calls `onDone` once the count reaches zero.
 */
export function Countdown({ from = 3, onDone }: { from?: number; onDone: () => void }) {
  const [n, setN] = React.useState(from);
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  React.useEffect(() => {
    let current = from;
    setN(current);
    const id = window.setInterval(() => {
      current -= 1;
      if (current <= 0) {
        window.clearInterval(id);
        doneRef.current();
      } else {
        setN(current);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [from]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Get ready</span>
        <span
          key={n}
          className="animate-pop font-mono text-8xl font-black tabular-nums text-foreground sm:text-9xl"
        >
          {n}
        </span>
      </div>
    </div>
  );
}
