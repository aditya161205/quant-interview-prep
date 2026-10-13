"use client";

import { DeskShell } from "@/components/shells/desk-shell";
import { MetroShell } from "@/components/shells/metro-shell";
import { SlateShell } from "@/components/shells/slate-shell";

/** The page frame for the candidates that bring their own layout. */
export function DesignShell({ design, children }: { design: string; children: React.ReactNode }) {
  if (design === "metro") return <MetroShell>{children}</MetroShell>;
  if (design === "slate") return <SlateShell>{children}</SlateShell>;
  return <DeskShell>{children}</DeskShell>;
}
