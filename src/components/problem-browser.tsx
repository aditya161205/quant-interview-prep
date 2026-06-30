"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
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

  const [facets, setFacets] = React.useState<Facets>({ categories: [], companies: [], difficulties: [] });
  const [items, setItems] = React.useState<ProblemMeta[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("All");
  const [category, setCategory] = React.useState("All");
  const [company, setCompany] = React.useState("All");
  const [status, setStatus] = React.useState<StatusFilter>("All");

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

      <div className="px-1 text-xs text-muted">
        {loading ? "Loading…" : `${rows.length} problem${rows.length === 1 ? "" : "s"}`}
      </div>

      {/* Table */}
      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted">
          No problems match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[3rem_1fr_8rem_5rem] gap-3 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid-cols-[3.5rem_1fr_10rem_12rem_6rem]">
            <span>#</span>
            <span>Problem</span>
            <span className="hidden sm:block">Category</span>
            <span className="hidden sm:block">Company</span>
            <span className="text-right">Level</span>
          </div>
          {rows.map((p, i) => (
            <Link
              key={p.id}
              href={`/practice/${p.id}`}
              className="grid grid-cols-[3rem_1fr_8rem_5rem] items-center gap-3 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-surface-2/40 sm:grid-cols-[3.5rem_1fr_10rem_12rem_6rem]"
            >
              <span className="font-mono text-muted">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.title}</span>
                {isSolved(p.id) && <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">Solved</span>}
                <span className="block truncate text-xs text-muted sm:hidden">{p.category}</span>
              </span>
              <span className="hidden truncate text-muted sm:block">{p.category}</span>
              <span className="hidden truncate text-muted sm:block">{p.companies.join(", ") || "—"}</span>
              <span className="flex justify-end">
                <DifficultyBadge difficulty={p.difficulty as Difficulty} />
              </span>
            </Link>
          ))}
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
