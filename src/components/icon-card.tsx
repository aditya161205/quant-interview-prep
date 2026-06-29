import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardColor = "violet" | "emerald" | "amber" | "rose" | "pink" | "indigo" | "sky";

const TILE: Record<CardColor, string> = {
  violet: "bg-violet-600",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
};

const GLOW: Record<CardColor, string> = {
  violet: "bg-violet-600",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
};

export function IconCard({
  href,
  title,
  kicker,
  description,
  icon: Icon,
  color = "violet",
  watermark,
}: {
  href: string;
  title: string;
  kicker?: string;
  description?: string;
  icon: LucideIcon;
  color?: CardColor;
  watermark?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-foreground/25"
    >
      {/* corner glow */}
      <div className={cn("pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-50", GLOW[color])} />

      {/* faint watermark */}
      {watermark && (
        <span className="pointer-events-none absolute -bottom-6 right-2 select-none text-[7rem] font-black uppercase leading-none tracking-tighter text-foreground/[0.03]">
          {watermark}
        </span>
      )}

      <div className="relative flex items-start justify-between">
        <span className={cn("grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg", TILE[color])}>
          <Icon className="h-6 w-6" />
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <h3 className="relative mt-6 text-xl font-extrabold tracking-tight">{title}</h3>
      {kicker && (
        <p className="relative mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">{kicker}</p>
      )}
      {description && <p className="relative mt-3 text-sm leading-relaxed text-muted">{description}</p>}
    </Link>
  );
}
