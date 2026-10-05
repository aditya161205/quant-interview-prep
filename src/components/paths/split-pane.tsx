"use client";

import * as React from "react";
import { useStored } from "@/components/paths/use-stored";
import { cn } from "@/lib/utils";

const clamp = (v: number) => Math.min(80, Math.max(20, v));

/**
 * Two panes with a draggable (and arrow-key adjustable) boundary on wide screens; stacked on narrow
 * ones. The split is remembered per `storageKey`.
 */
export function SplitPane({
  storageKey,
  initial = 50,
  left,
  right,
}: {
  storageKey: string;
  initial?: number;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const saved = Number(useStored(storageKey));
  const [override, setPct] = React.useState<number | null>(null);
  const pct = override ?? (saved ? clamp(saved) : initial);
  const [dragging, setDragging] = React.useState(false);

  const remember = (v: number) => {
    try {
      localStorage.setItem(storageKey, String(Math.round(v)));
    } catch {}
  };

  return (
    <div
      ref={box}
      className="flex flex-col gap-5 lg:grid lg:items-stretch lg:gap-0"
      style={{ gridTemplateColumns: `minmax(0, ${pct}%) 16px minmax(0, 1fr)` }}
    >
      {left}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        className={cn("split-gutter hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block", dragging && "is-dragging")}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging || !box.current) return;
          const r = box.current.getBoundingClientRect();
          setPct(clamp(((e.clientX - r.left) / r.width) * 100));
        }}
        onLostPointerCapture={() => {
          setDragging(false);
          remember(pct);
        }}
        onKeyDown={(e) => {
          const step = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
          if (!step) return;
          e.preventDefault();
          const v = clamp(pct + step);
          setPct(v);
          remember(v);
        }}
      />
      {right}
    </div>
  );
}
