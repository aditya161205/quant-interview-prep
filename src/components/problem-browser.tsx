"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search, Bookmark, Check, X, ArrowUpRight,
  Percent, Sigma, Lightbulb, Boxes, type LucideIcon,
} from "lucide-react";
import type { Difficulty, Problem, Topic } from "@/data/problems";
import { usePracticeStore, useMounted } from "@/store/practice-store";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { cn } from "@/lib/utils";

type DiffFilter = "All" | Difficulty;
type StatusFilter = "All" | "Solved" | "Unsolved" | "Bookmarked";
type TopicFilter = "All" | Topic;

const DIFFS: DiffFilter[] = ["All", "Easy", "Medium", "Hard"];
const STATUSES: StatusFilter[] = ["All", "Solved", "Unsolved", "Bookmarked"];
const TOPICS: TopicFilter[] = [
  "All",
  "Probability",
  "Expected Value",
  "Brainteaser",
  "Combinatorics",
];

const TOPIC_STYLE: Record<Topic, { tile: string; Icon: LucideIcon }> = {
  Probability: { tile: "bg-violet-600", Icon: Percent },
  "Expected Value": { tile: "bg-emerald-500", Icon: Sigma },
  Brainteaser: { tile: "bg-amber-500", Icon: Lightbulb },
  Combinatorics: { tile: "bg-rose-500", Icon: Boxes },
};

export function ProblemBrowser({ problems }: { problems: Problem[] }) {
  const mounted = useMounted();
  const solved = usePracticeStore((s) => s.solved);
  const bookmarked = usePracticeStore((s) => s.bookmarked);
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);
  const toggleBookmark = usePracticeStore((s) => s.toggleBookmark);

  const [query, setQuery] = React.useState("");
  const [diff, setDiff] = React.useState<DiffFilter>("All");
  const [topic, setTopic] = React.useState<TopicFilter>("All");
  const [status, setStatus] = React.useState<StatusFilter>("All");

  // Persisted state is only trusted after mount to avoid hydration mismatch.
  const isSolved = (id: string) => mounted && !!solved[id];
  const isBookmarked = (id: string) => mounted && !!bookmarked[id];

  const filtered = problems.filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !`${p.title} ${p.topic}`.toLowerCase().includes(q)) return false;
    if (diff !== "All" && p.difficulty !== diff) return false;
    if (topic !== "All" && p.topic !== topic) return false;
    if (status === "Solved" && !isSolved(p.id)) return false;
    if (status === "Unsolved" && isSolved(p.id)) return false;
    if (status === "Bookmarked" && !isBookmarked(p.id)) return false;
    return true;
  });

  const solvedCount = mounted ? problems.filter((p) => solved[p.id]).length : 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems…"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <FilterRow label="Category" options={TOPICS} value={topic} onChange={setTopic} />
          <FilterRow label="Difficulty" options={DIFFS} value={diff} onChange={setDiff} />
          <FilterRow label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted">
        <span>
          Showing {filtered.length} of {problems.length}
        </span>
        <span>{solvedCount} solved</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">
          No problems match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const done = isSolved(p.id);
            const marked = isBookmarked(p.id);
            const { tile, Icon } = TOPIC_STYLE[p.topic];
            return (
              <div
                key={p.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-foreground/25"
              >
                <Link href={`/practice/${p.id}`} className="absolute inset-0" aria-label={p.title} />
                <div className={cn("pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl", tile)} />

                <div className="pointer-events-none relative flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <span className={cn("grid h-11 w-11 place-items-center rounded-xl text-white shadow-lg", tile)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>

                  <h3 className="mt-5 text-base font-bold leading-snug">{p.title}</h3>

                  <div className="mt-auto flex items-center justify-between pt-5">
                    <div className="flex items-center gap-2">
                      <DifficultyBadge difficulty={p.difficulty} />
                      <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted sm:inline">
                        {p.topic}
                      </span>
                    </div>
                    <div className="pointer-events-auto flex items-center gap-1">
                      <button
                        onClick={() => toggleSolved(p.id)}
                        title={done ? "Mark as unsolved" : "Mark as solved"}
                        aria-label={done ? "Mark as unsolved" : "Mark as solved"}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-full transition-colors",
                          done ? "bg-emerald-500/15 text-emerald-500" : "text-muted hover:text-foreground",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleBookmark(p.id)}
                        title={marked ? "Remove bookmark" : "Bookmark"}
                        aria-label={marked ? "Remove bookmark" : "Bookmark"}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-full transition-colors",
                          marked ? "text-accent" : "text-muted hover:text-foreground",
                        )}
                      >
                        <Bookmark className={cn("h-4 w-4", marked && "fill-accent")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium transition-colors",
              value === opt
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
