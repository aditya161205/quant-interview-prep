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
    <div className="fixed inset-0 z-50 grid place-items-center bg-jacket text-jacket-ink">
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="font-x text-sm font-extrabold uppercase tracking-[0.3em] opacity-80">Get ready</span>
        <span
          key={n}
          className="animate-pop font-xx text-[10rem] font-black leading-none tabular-nums sm:text-[14rem]"
        >
          {n}
        </span>
      </div>
    </div>
  );
}
