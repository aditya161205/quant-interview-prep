"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  RefreshCw,
  Lock,
} from "lucide-react";
import { usePracticeStore, useMounted } from "@/store/practice-store";
import { DifficultyBadge } from "@/components/difficulty-badge";
import type { Difficulty, ProblemMeta } from "@/lib/problems";
import { companyCode } from "@/lib/pit";
import { cn } from "@/lib/utils";

type StatusFilter = "All" | "Solved" | "Unsolved" | "Bookmarked";
const STATUSES: StatusFilter[] = ["All", "Solved", "Unsolved", "Bookmarked"];
const DIFFS = ["All", "Easy", "Medium", "Hard"];

interface Facets {
  categories: string[];
  companies: string[];
  difficulties: string[];
}

/** Why the list came back empty — each case gets its own message. */
type LoadError = "not_configured" | "unauthorized" | "failed";

interface ListPayload {
  problems?: ProblemMeta[];
  ids?: number[];
  total?: number;
  error?: string;
}

type Loaded = { ok: true; data: ListPayload } | { ok: false; error: LoadError };

/** One list request, with the failure modes kept apart rather than swallowed. */
async function load(url: string, signal: AbortSignal): Promise<Loaded> {
  try {
    const r = await fetch(url, { signal });
    const d = (await r.json().catch(() => ({}))) as ListPayload;
    if (r.ok) return { ok: true, data: d };
    if (d.error === "not_configured") return { ok: false, error: "not_configured" };
    return { ok: false, error: r.status === 401 ? "unauthorized" : "failed" };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export function ProblemBrowser() {
  const mounted = useMounted();
  const solvedMap = usePracticeStore((s) => s.solved);
  const bookmarkedMap = usePracticeStore((s) => s.bookmarked);
  const toggleSolved = usePracticeStore((s) => s.toggleSolved);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [facets, setFacets] = React.useState<Facets>({ categories: [], companies: [], difficulties: [] });
  const [items, setItems] = React.useState<ProblemMeta[] | null>(null);
  const [total, setTotal] = React.useState<number | null>(null);
  const [matchIds, setMatchIds] = React.useState<{ key: string; ids: number[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<LoadError | null>(null);
  const [retry, setRetry] = React.useState(0);

  // Initial filter state comes from the URL, so it survives navigation/back.
  const [query, setQuery] = React.useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = React.useState(sp.get("q") ?? "");
  const [difficulty, setDifficulty] = React.useState(sp.get("difficulty") ?? "All");
  const [category, setCategory] = React.useState(sp.get("category") ?? "All");
  const [company, setCompany] = React.useState(sp.get("company") ?? "All");
  const [status, setStatus] = React.useState<StatusFilter>((sp.get("status") as StatusFilter) ?? "All");
  const [pageSize, setPageSize] = React.useState(Number(sp.get("size")) || 25);
  const [page, setPage] = React.useState(Number(sp.get("page")) || 1);

  React.useEffect(() => {
    fetch("/api/problems/facets")
      .then((r) => r.json())
      .then((d: Partial<Facets>) =>
        setFacets({
          categories: d.categories ?? [],
          companies: d.companies ?? [],
          difficulties: d.difficulties ?? [],
        }),
      )
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Everything the server can filter on.
  const filterQs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (difficulty !== "All") p.set("difficulty", difficulty);
    if (category !== "All") p.set("category", category);
    if (company !== "All") p.set("company", company);
    if (debounced) p.set("q", debounced);
    return p.toString();
  }, [difficulty, category, company, debounced]);

  const byStatus = status !== "All";

  // Status is localStorage state, so the server can't apply it. This is the id
  // set it selects on, flattened into a stable dependency for the fetches below.
  const markedKey = React.useMemo(() => {
    if (!byStatus || !mounted) return "";
    const src = status === "Bookmarked" ? bookmarkedMap : solvedMap;
    return Object.keys(src)
      .filter((k) => src[k])
      .sort()
      .join(",");
  }, [byStatus, mounted, status, solvedMap, bookmarkedMap]);

  // A page restored from the URL — or a result set that just shrank — can point
  // past the end. Pull it back as soon as the real total is known.
  const clampPage = React.useCallback(
    (count: number) => setPage((p) => Math.min(p, Math.max(1, Math.ceil(count / pageSize)))),
    [pageSize],
  );

  // With a Status filter on, the client owns the paging, so it needs every
  // matching id — a few KB of ids rather than the whole result set as rows.
  React.useEffect(() => {
    if (!byStatus) return;
    const p = new URLSearchParams(filterQs);
    p.set("fields", "ids");
    const ctrl = new AbortController();
    void (async () => {
      setLoading(true);
      const res = await load(`/api/problems?${p}`, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setError(res.error);
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      setError(null);
      setMatchIds({ key: filterQs, ids: res.data.ids ?? [] });
    })();
    return () => ctrl.abort();
  }, [byStatus, filterQs, retry]);

  // One page of rows. The server pages it directly unless Status is narrowing
  // the set, in which case only the ids for this page are hydrated.
  React.useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      setLoading(true);
      let url: string;
      let localTotal: number | null = null;

      if (byStatus) {
        // Still waiting on the persisted store or on the matching id set.
        const ids = matchIds?.key === filterQs ? matchIds.ids : null;
        if (!mounted || !ids) return;
        const marked = new Set(markedKey ? markedKey.split(",") : []);
        const matched = ids.filter((id) =>
          status === "Unsolved" ? !marked.has(String(id)) : marked.has(String(id)),
        );
        localTotal = matched.length;
        const slice = matched.slice((page - 1) * pageSize, page * pageSize);
        if (slice.length === 0) {
          setError(null);
          setItems([]);
          setTotal(localTotal);
          // A page past the end settles on the next pass; anything else really
          // is an empty result.
          if (page > 1 && localTotal > 0) clampPage(localTotal);
          else setLoading(false);
          return;
        }
        url = `/api/problems?ids=${slice.join(",")}`;
      } else {
        const p = new URLSearchParams(filterQs);
        p.set("page", String(page));
        p.set("pageSize", String(pageSize));
        url = `/api/problems?${p}`;
      }

      const res = await load(url, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setError(res.error);
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const next = localTotal ?? res.data.total ?? 0;
      setError(null);
      setItems(res.data.problems ?? []);
      setTotal(next);
      setLoading(false);
      clampPage(next);
    })();
    return () => ctrl.abort();
  }, [byStatus, mounted, matchIds, markedKey, status, filterQs, page, pageSize, retry, clampPage]);

  const isSolved = (id: number) => mounted && !!solvedMap[String(id)];

  const rows = items ?? [];
  const count = total ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const filtersOn =
    difficulty !== "All" || category !== "All" || company !== "All" || status !== "All" || query !== "";

  const clearAll = () => {
    setQuery("");
    setDebounced("");
    setDifficulty("All");
    setCategory("All");
    setCompany("All");
    setStatus("All");
  };

  // Shared query string — drives both the URL and each problem link.
  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("q", debounced);
    if (difficulty !== "All") p.set("difficulty", difficulty);
    if (category !== "All") p.set("category", category);
    if (company !== "All") p.set("company", company);
    if (status !== "All") p.set("status", status);
    if (page > 1) p.set("page", String(page));
    if (pageSize !== 25) p.set("size", String(pageSize));
    return p.toString();
  }, [debounced, difficulty, category, company, status, page, pageSize]);

  // Keep the URL in sync so filters persist across navigation/back.
  React.useEffect(() => {
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [qs, pathname, router]);

  // Reset to page 1 when filters change — but not on first mount, so a page
  // restored from the URL is preserved.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [difficulty, category, company, status, debounced, pageSize]);

  const emptyState = (
    <div className="rounded-2xl bg-surface px-6 py-16 text-center shadow-(--shadow-card)">
      {error === "not_configured" ? (
        <>
          <p className="font-x text-lg font-extrabold">Problem library unavailable</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            This deployment is missing its database credentials, so nothing can be loaded. The list is not empty; it is
            unreachable.
          </p>
        </>
      ) : error === "unauthorized" ? (
        <>
          <p className="font-x text-lg font-extrabold">Sign in to browse problems</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">Your session has expired, or you are signed out on this device.</p>
          <Link href="/login" className="font-x mt-5 inline-flex h-10 items-center rounded-[6px] bg-jacket px-5 font-bold text-jacket-ink">
            Sign in
          </Link>
        </>
      ) : error === "failed" ? (
        <>
          <p className="font-x text-lg font-extrabold">Couldn&apos;t load problems</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">The request didn&apos;t come back. Check your connection and try again.</p>
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="font-x mt-5 inline-flex h-10 items-center gap-1.5 rounded-[6px] border-[1.5px] border-foreground px-5 font-bold hover:bg-foreground hover:text-background"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </>
      ) : (
        <>
          <p className="font-x text-lg font-extrabold">No problems match your filters.</p>
          {filtersOn && (
            <button
              onClick={clearAll}
              className="font-x mt-5 inline-flex h-10 items-center gap-1.5 rounded-[6px] border-[1.5px] border-foreground px-5 font-bold hover:bg-foreground hover:text-background"
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      {/* Filter rail */}
      <aside aria-label="Filters" className="space-y-6 rounded-2xl bg-surface p-5 shadow-(--shadow-card) lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search problems by title"
            placeholder="Search problems"
            className="h-11 w-full rounded-[6px] border-[1.5px] border-foreground bg-surface pl-9 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <FilterList label="Level" options={DIFFS} value={difficulty} onChange={setDifficulty} />
        <FilterList label="Status" options={STATUSES} value={status} onChange={(v) => setStatus(v as StatusFilter)} />
        {facets.categories.length > 0 && (
          <FilterList label="Topic" options={["All", ...facets.categories]} value={category} onChange={setCategory} />
        )}
        {facets.companies.length > 0 && (
          <fieldset>
            <legend className="font-x mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">Firm</legend>
            <div className="flex flex-wrap gap-1.5">
              {["All", ...facets.companies].map((c) => (
                <button
                  key={c}
                  onClick={() => setCompany(c)}
                  title={c}
                  aria-pressed={company === c}
                  className={cn(
                    "font-xx rounded-[3px] px-2 py-1.5 text-xs font-black tracking-[0.06em] transition-colors",
                    company === c ? "bg-jacket text-jacket-ink" : "bg-surface-2 text-foreground hover:bg-border",
                  )}
                >
                  {c === "All" ? "ALL" : companyCode(c)}
                </button>
              ))}
            </div>
            {company !== "All" && <p className="mt-2 text-xs text-muted">{company}</p>}
          </fieldset>
        )}

        {filtersOn && (
          <button onClick={clearAll} className="font-x inline-flex items-center gap-1.5 text-sm font-bold text-jacket-text hover:underline">
            <X className="h-4 w-4" /> Clear all filters
          </button>
        )}
      </aside>

      {/* Board */}
      <section aria-label="Problems" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-xx text-3xl font-black tabular-nums">
            {loading ? "…" : error ? "—" : count.toLocaleString("en-IN")}
            <span className="ml-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">
              problem{count === 1 ? "" : "s"}
            </span>
          </p>
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 rounded-[6px] border-[1.5px] border-foreground bg-surface px-2 font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {[25, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!loading && rows.length === 0 ? (
          emptyState
        ) : (
          <div className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
            <div className="font-x grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_2.5rem] gap-4 border-b-[3px] border-jacket px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-muted md:grid-cols-[3rem_8.5rem_minmax(0,1fr)_5.5rem_2.5rem]">
              <span>#</span>
              <span className="hidden md:block">Asked at</span>
              <span>Problem</span>
              <span>Level</span>
              <span className="text-right">Done</span>
            </div>
            {rows.map((p, i) => {
              const done = isSolved(p.id);
              return (
                <div
                  key={p.id}
                  className="relative grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_2.5rem] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-jacket/[0.05] md:grid-cols-[3rem_8.5rem_minmax(0,1fr)_5.5rem_2.5rem]"
                >
                  <Link href={`/practice/${p.id}${qs ? `?${qs}` : ""}`} className="absolute inset-0" aria-label={p.title} />
                  <span className="font-x pointer-events-none font-extrabold tabular-nums text-muted">{(page - 1) * pageSize + i + 1}</span>
                  <span className="pointer-events-none hidden flex-wrap gap-1 md:flex">
                    {p.companies.length === 0 && <span className="text-sm text-muted">—</span>}
                    {p.companies.slice(0, 3).map((c) => (
                      <span key={c} title={c} className="font-xx rounded-[3px] bg-foreground px-1.5 py-1 text-[0.65rem] font-black tracking-[0.06em] text-background">
                        {companyCode(c)}
                      </span>
                    ))}
                  </span>
                  <span className="pointer-events-none min-w-0">
                    <span className="flex items-center gap-1.5">
                      {p.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Pro" />}
                      <span className="font-x truncate font-bold">{p.title}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">{p.category}</span>
                  </span>
                  <span className="pointer-events-none">
                    <DifficultyBadge difficulty={p.difficulty as Difficulty} className="w-full" />
                  </span>
                  <span className="flex justify-end">
                    <button
                      onClick={() => toggleSolved(String(p.id))}
                      title={done ? "Mark as unsolved" : "Mark as done"}
                      aria-label={done ? "Mark as unsolved" : "Mark as done"}
                      aria-pressed={done}
                      className={cn(
                        "relative grid h-7 w-7 place-items-center rounded-[4px] border-[1.5px] transition-colors",
                        done ? "border-positive bg-positive text-white" : "border-border text-transparent hover:border-positive hover:text-positive/50",
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

        {!loading && !error && pageCount > 1 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <Step label="First page" onClick={() => setPage(1)} disabled={page <= 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Step>
            <Step label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Step>
            {pageWindow(page, pageCount).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} className="px-1 text-sm text-muted">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(
                    "font-x h-10 min-w-10 rounded-[6px] px-3 text-sm font-extrabold tabular-nums transition-colors",
                    n === page ? "bg-jacket text-jacket-ink" : "bg-surface text-foreground shadow-(--shadow-card) hover:bg-surface-2",
                  )}
                >
                  {n}
                </button>
              ),
            )}
            <Step label="Next page" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
              <ChevronRight className="h-4 w-4" />
            </Step>
            <Step label="Last page" onClick={() => setPage(pageCount)} disabled={page >= pageCount}>
              <ChevronsRight className="h-4 w-4" />
            </Step>
          </nav>
        )}
      </section>
    </div>
  );
}

/** Page numbers around the current one; null marks an elided run. */
function pageWindow(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 1, count - 3));
  const end = Math.min(count - 1, Math.max(current + 1, 4));
  const out: (number | null)[] = [1];
  if (start > 2) out.push(null);
  for (let n = start; n <= end; n++) out.push(n);
  if (end < count - 1) out.push(null);
  out.push(count);
  return out;
}

function Step({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-[6px] bg-surface text-foreground shadow-(--shadow-card) transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** One filter as a stacked list of plates; the chosen one wears the jacket. */
function FilterList({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="font-x mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{label}</legend>
      <div className="grid gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            className={cn(
              "font-x flex items-center justify-between rounded-[4px] px-3 py-2 text-left text-sm font-bold transition-colors",
              value === opt ? "bg-jacket text-jacket-ink" : "text-foreground hover:bg-surface-2",
            )}
          >
            {opt}
            {value === opt && <Check className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
