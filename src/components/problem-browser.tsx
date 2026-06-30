"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { usePracticeStore, useMounted } from "@/store/practice-store";
import { DifficultyBadge } from "@/components/difficulty-badge";
import type { Difficulty, ProblemMeta } from "@/lib/problems";
import { cn } from "@/lib/utils";

type StatusFilter = "All" | "Solved" | "Unsolved" | "Bookmarked";
const STATUSES: StatusFilter[] = ["All", "Solved", "Unsolved", "Bookmarked"];
const DIFFS = ["All", "Easy", "Medium", "Hard"];

interface Facets {
  categories: string[];
  companies: string[];
  difficulties: string[];
}

export function ProblemBrowser() {
  const mounted = useMounted();
  const solvedMap = usePracticeStore((s) => s.solved);
  const bookmarkedMap = usePracticeStore((s) => s.bookmarked);
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);

  const [facets, setFacets] = React.useState<Facets>({ categories: [], companies: [], difficulties: [] });
  const [items, setItems] = React.useState<ProblemMeta[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("All");
  const [category, setCategory] = React.useState("All");
  const [company, setCompany] = React.useState("All");
  const [status, setStatus] = React.useState<StatusFilter>("All");
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    fetch("/api/problems/facets")
      .then((r) => r.json())
      .then((d: Facets) => setFacets(d))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (difficulty !== "All") params.set("difficulty", difficulty);
    if (category !== "All") params.set("category", category);
    if (company !== "All") params.set("company", company);
    if (debounced) params.set("q", debounced);

    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/problems?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { problems: ProblemMeta[] }) => {
        setItems(d.problems ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoading(false);
      });
    return () => ctrl.abort();
  }, [difficulty, category, company, debounced]);

  const isSolved = (id: number) => mounted && !!solvedMap[String(id)];
  const isBookmarked = (id: number) => mounted && !!bookmarkedMap[String(id)];

  const rows = (items ?? []).filter((p) => {
    if (status === "Solved" && !isSolved(p.id)) return false;
    if (status === "Unsolved" && isSolved(p.id)) return false;
    if (status === "Bookmarked" && !isBookmarked(p.id)) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 whenever the result set or page size changes.
  React.useEffect(() => {
    setPage(1);
  }, [difficulty, category, company, status, debounced, pageSize]);

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
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Chips label="Difficulty" options={DIFFS} value={difficulty} onChange={setDifficulty} />
          <Chips label="Status" options={STATUSES} value={status} onChange={(v) => setStatus(v as StatusFilter)} />
          <Select label="Category" value={category} onChange={setCategory} options={facets.categories} />
          <Select label="Company" value={company} onChange={setCompany} options={facets.companies} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted">
        <span>{loading ? "Loading…" : `${rows.length} problem${rows.length === 1 ? "" : "s"}`}</span>
        <label className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-7 rounded-full border border-border bg-surface px-2.5 font-mono text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {[25, 50, 75, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Table */}
      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">
          No problems match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[2.25rem_1fr_5rem_2.25rem] gap-3 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid-cols-[3rem_1fr_9rem_11rem_5.5rem_2.5rem]">
            <span>#</span>
            <span>Problem</span>
            <span className="hidden sm:block">Category</span>
            <span className="hidden sm:block">Company</span>
            <span className="text-right">Level</span>
            <span className="text-right">Done</span>
          </div>
          {pageRows.map((p, i) => {
            const done = isSolved(p.id);
            return (
              <div
                key={p.id}
                className="group relative grid grid-cols-[2.25rem_1fr_5rem_2.25rem] items-center gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-surface-2/40 sm:grid-cols-[3rem_1fr_9rem_11rem_5.5rem_2.5rem]"
              >
                <Link href={`/practice/${p.id}`} className="absolute inset-0" aria-label={p.title} />
                <span className="pointer-events-none font-mono text-muted">{(safePage - 1) * pageSize + i + 1}</span>
                <span className="pointer-events-none min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block truncate text-xs text-muted sm:hidden">{p.category}</span>
                </span>
                <span className="pointer-events-none hidden truncate text-muted sm:block">{p.category}</span>
                <span className="pointer-events-none hidden truncate text-muted sm:block">{p.companies.join(", ") || "—"}</span>
                <span className="pointer-events-none flex justify-end">
                  <DifficultyBadge difficulty={p.difficulty as Difficulty} />
                </span>
                <span className="flex justify-end">
                  <button
                    onClick={() => toggleSolved(String(p.id))}
                    title={done ? "Mark as unsolved" : "Mark as done"}
                    aria-label={done ? "Mark as unsolved" : "Mark as done"}
                    aria-pressed={done}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md border transition-colors",
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border text-transparent hover:border-emerald-500/60 hover:text-emerald-500/40",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Page {safePage} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage >= pageCount}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Chips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
              value === opt ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
