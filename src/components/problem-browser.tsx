"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Bookmark, Check, ChevronRight, X } from "lucide-react";
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">
          No problems match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {filtered.map((p) => {
            const done = isSolved(p.id);
            const marked = isBookmarked(p.id);
            const number = problems.indexOf(p) + 1;
            return (
              <div
                key={p.id}
                className="group flex items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:px-4"
              >
                <button
                  onClick={() => toggleSolved(p.id)}
                  title={done ? "Mark as unsolved" : "Mark as solved"}
                  aria-label={done ? "Mark as unsolved" : "Mark as solved"}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono text-sm transition-colors",
                    done
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                      : "border-border bg-surface-2 text-muted hover:border-accent/50 hover:text-accent",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : String(number).padStart(2, "0")}
                </button>

                <Link href={`/practice/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium transition-colors group-hover:text-accent">
                    {p.title}
                  </div>
                  <div className="text-sm text-muted">{p.topic}</div>
                </Link>

                <DifficultyBadge difficulty={p.difficulty} className="hidden sm:inline-flex" />

                <button
                  onClick={() => toggleBookmark(p.id)}
                  title={marked ? "Remove bookmark" : "Bookmark"}
                  aria-label={marked ? "Remove bookmark" : "Bookmark"}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
                    marked ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  <Bookmark className={cn("h-[18px] w-[18px]", marked && "fill-accent")} />
                </button>

                <Link
                  href={`/practice/${p.id}`}
                  aria-label={`Open ${p.title}`}
                  className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
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
