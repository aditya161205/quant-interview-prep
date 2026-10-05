"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, Bookmark, Gamepad2, Flame, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Difficulty, ProblemMeta } from "@/lib/problems";
import { usePracticeStore, useMounted, dayKey } from "@/store/practice-store";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The subset of /api/problems/facets this view reads. */
interface Facets {
  total?: number;
  categoryCounts?: Record<string, number>;
  difficultyCounts?: Record<string, number>;
}

const HEATMAP_WEEKS = 26;
// Every other weekday, GitHub-style — all seven would crowd the axis.
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ProfileView() {
  const mounted = useMounted();
  const solvedMap = usePracticeStore((s) => s.solved);
  const bookmarkedMap = usePracticeStore((s) => s.bookmarked);
  const activity = usePracticeStore((s) => s.activity);
  const games = usePracticeStore((s) => s.games);

  // Only trust persisted values after mount.
  const solved = mounted ? solvedMap : {};
  const booked = mounted ? bookmarkedMap : {};
  const acts = mounted ? activity : {};
  const gamesPlayed = mounted ? games : 0;
  const isSolved = (id: number) => !!solved[String(id)];
  const isBooked = (id: number) => !!booked[String(id)];

  // The denominators come from the cached facet tallies, so this page never
  // downloads the problem bank just to count it.
  const [facets, setFacets] = React.useState<Facets | null>(null);
  React.useEffect(() => {
    fetch("/api/problems/facets")
      .then((r) => r.json())
      .then((d: Facets) => setFacets(d))
      .catch(() => {});
  }, []);

  // …and the rows themselves are only fetched for the problems this user has
  // actually touched, which is what the breakdowns and bookmark list need.
  // Keyed off the store maps directly — the `mounted` fallbacks above are fresh
  // objects each render and would retrigger the fetch forever.
  const mineKey = React.useMemo(() => {
    if (!mounted) return "";
    const ids = new Set<string>();
    for (const [k, v] of Object.entries(solvedMap)) if (v) ids.add(k);
    for (const [k, v] of Object.entries(bookmarkedMap)) if (v) ids.add(k);
    return [...ids]
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b)
      .join(",");
  }, [mounted, solvedMap, bookmarkedMap]);

  // Nothing to clear when the key empties: the lists below are filtered against
  // the live solved/bookmarked maps, so stale rows simply drop out.
  const [problems, setProblems] = React.useState<ProblemMeta[]>([]);
  React.useEffect(() => {
    if (!mineKey) return;
    const ctrl = new AbortController();
    // The route caps one `ids` request at 1000, so ask in batches.
    const ids = mineKey.split(",");
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 1000) batches.push(ids.slice(i, i + 1000));
    Promise.all(
      batches.map((b) =>
        fetch(`/api/problems?ids=${b.join(",")}`, { signal: ctrl.signal })
          .then((r) => r.json())
          .then((d: { problems?: ProblemMeta[] }) => d.problems ?? []),
      ),
    )
      .then((pages) => setProblems(pages.flat()))
      .catch(() => {});
    return () => ctrl.abort();
  }, [mineKey]);

  const total = facets?.total ?? 0;
  const solvedList = problems.filter((p) => isSolved(p.id));
  const bookmarkedList = problems.filter((p) => isBooked(p.id));

  // Totals come from the facets; only the "done" side needs the fetched rows.
  const byDifficulty: Record<Difficulty, { total: number; done: number }> = {
    Easy: { total: facets?.difficultyCounts?.Easy ?? 0, done: 0 },
    Medium: { total: facets?.difficultyCounts?.Medium ?? 0, done: 0 },
    Hard: { total: facets?.difficultyCounts?.Hard ?? 0, done: 0 },
  };
  const byTopic: Record<string, { total: number; done: number }> = {};
  for (const [topic, n] of Object.entries(facets?.categoryCounts ?? {})) {
    byTopic[topic] = { total: n, done: 0 };
  }
  for (const p of solvedList) {
    const d = (["Easy", "Medium", "Hard"].includes(p.difficulty) ? p.difficulty : "Medium") as Difficulty;
    byDifficulty[d].done++;
    byTopic[p.category] ??= { total: 0, done: 0 };
    byTopic[p.category].done++;
  }

  const { current, best } = streaks(acts);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CircleCheck} label="Problems solved" value={`${solvedList.length}/${total}`} />
        <StatCard icon={Bookmark} label="Bookmarked" value={String(bookmarkedList.length)} />
        <StatCard icon={Gamepad2} label="Games played" value={String(gamesPlayed)} />
        <StatCard icon={Flame} label="Current streak" value={`${current}d`} sub={`best ${best}d`} />
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <p className="text-sm text-muted">Problems solved and games played over the last 6 months.</p>
        </CardHeader>
        <CardContent>
          <Heatmap activity={acts} />
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">By difficulty</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 py-2">
              {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
                <Dial key={d} difficulty={d} done={byDifficulty[d].done} total={byDifficulty[d].total} />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(byTopic).map(([topic, v]) => (
              <ProgressRow key={topic} label={<span className="text-sm">{topic}</span>} done={v.done} total={v.total} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bookmarked */}
      <BookmarkedCard problems={bookmarkedList} isSolved={isSolved} />
    </div>
  );
}

const BOOKMARKS_PER_PAGE = 8;

function BookmarkedCard({ problems, isSolved }: { problems: ProblemMeta[]; isSolved: (id: number) => boolean }) {
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(problems.length / BOOKMARKS_PER_PAGE));

  // Keep the page in range if bookmarks change underneath us.
  React.useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const start = page * BOOKMARKS_PER_PAGE;
  const rows = problems.slice(start, start + BOOKMARKS_PER_PAGE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Bookmarked problems
            {problems.length > 0 && <span className="ml-2 text-sm font-normal text-muted">({problems.length})</span>}
          </CardTitle>
          <Link href="/practice" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
            All problems <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {problems.length === 0 ? (
          <p className="py-2 text-sm text-muted">No bookmarks yet — tap the bookmark icon on any problem to save it here.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <Link key={p.id} href={`/practice/${p.id}`} className="group flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5 transition-colors hover:border-accent/50">
                <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">{p.title}</span>
                {isSolved(p.id) && <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
                <DifficultyBadge difficulty={p.difficulty} className="hidden sm:inline-flex" />
              </Link>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-sm transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="font-mono text-xs text-muted">Page {page + 1} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-sm transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Flame; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-xl font-semibold">{value}</div>
          <div className="truncate text-xs text-muted">{label}{sub && ` · ${sub}`}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const DIFF_COLOR: Record<Difficulty, string> = {
  Easy: "#10b981", // emerald-500
  Medium: "#f59e0b", // amber-500
  Hard: "#f43f5e", // rose-500
};

/** A radial gauge showing solved / total for one difficulty. */
function Dial({ difficulty, done, total }: { difficulty: Difficulty; done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const size = 116;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = DIFF_COLOR[difficulty];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="var(--surface-2)" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums">{Math.round(pct * 100)}%</span>
          <span className="font-mono text-xs text-muted">{done}/{total}</span>
        </div>
      </div>
      <DifficultyBadge difficulty={difficulty} />
    </div>
  );
}

function ProgressRow({ label, done, total }: { label: React.ReactNode; done: number; total: number }) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label}
        <span className="font-mono text-xs text-muted">{done}/{total}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* --------------------------------- heatmap --------------------------- */

type Day = { date: Date; count: number };

function level(count: number): string {
  // The empty step is a neutral gray, not bg-surface-2 — that measured 1.12:1
  // against the card, so "no activity" was invisible. The accent steps move up
  // to 50/75/100% to keep every neighbouring pair at least 1.3:1 apart.
  if (count <= 0) return "bg-foreground/20 dark:bg-foreground/15";
  if (count <= 2) return "bg-accent/50";
  if (count <= 5) return "bg-accent/75";
  return "bg-accent";
}

// Pinned locale: these strings are server-rendered into each cell's aria-label,
// so an ambient locale would hydrate as a mismatch.
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** The one description of a cell — used for the tooltip and the cell's a11y name. */
function describeDay(day: Day): string {
  return `${fmtDate(day.date)} · ${day.count} ${day.count === 1 ? "activity" : "activities"}`;
}

function Heatmap({ activity }: { activity: Record<string, number> }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const hintId = React.useId();
  const [tip, setTip] = React.useState<{ x: number; y: number; text: string } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const weeks: Day[][] = [];
  const d = new Date(start);
  while (d <= today) {
    const week: Day[] = [];
    for (let i = 0; i < 7; i++) {
      if (d <= today) {
        week.push({ date: new Date(d), count: activity[dayKey(d)] ?? 0 });
      }
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }

  // A column gets a month label when its week opens a month it didn't before.
  const months = weeks.map((week, wi) => {
    const month = week[0]?.date.getMonth();
    return month !== undefined && month !== weeks[wi - 1]?.[0]?.date.getMonth()
      ? week[0].date.toLocaleDateString("en-US", { month: "short" })
      : "";
  });

  const activeDays = weeks.reduce((n, w) => n + w.filter((day) => day.count > 0).length, 0);
  const totalCount = weeks.reduce((n, w) => n + w.reduce((m, day) => m + day.count, 0), 0);

  // The grid is one tab stop, not 186: arrow keys walk the cells and the
  // tooltip follows focus as well as hover, so nothing lives on hover alone.
  const last = weeks[weeks.length - 1];
  const [cursor, setCursor] = React.useState<[number, number]>([weeks.length - 1, last.length - 1]);

  const moveTo = (w: number, i: number) => {
    const nw = Math.min(Math.max(w, 0), weeks.length - 1);
    const ni = Math.min(Math.max(i, 0), weeks[nw].length - 1);
    setCursor([nw, ni]);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${nw}-${ni}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Read the position off the focused cell rather than state, so a burst of
    // keydowns can't act on a cursor that hasn't re-rendered yet.
    const [w, i] = ((e.target as HTMLElement).dataset.cell ?? "").split("-").map(Number);
    if (Number.isNaN(w) || Number.isNaN(i)) return;
    if (e.key === "ArrowLeft") moveTo(w - 1, i);
    else if (e.key === "ArrowRight") moveTo(w + 1, i);
    else if (e.key === "ArrowUp") moveTo(w, i - 1);
    else if (e.key === "ArrowDown") moveTo(w, i + 1);
    else if (e.key === "Home") moveTo(0, 0);
    else if (e.key === "End") moveTo(weeks.length - 1, 6);
    else return;
    e.preventDefault();
  };

  const showTip = (el: HTMLElement, day: Day) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    const cell = el.getBoundingClientRect();
    setTip({
      x: cell.left - wrap.left + cell.width / 2,
      y: cell.top - wrap.top,
      text: describeDay(day),
    });
  };

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="relative">
        {/* Axis labels are decorative for assistive tech — every cell already
            names its own full date. They stay hidden below sm, where the cells
            are too narrow to align type against. */}
        <div aria-hidden className="mb-1.5 hidden gap-1.5 sm:flex">
          <div className="w-8 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-1.5">
            {months.map((m, wi) => (
              <span key={wi} className="min-w-0 flex-1 whitespace-nowrap text-2xs uppercase tracking-wider text-muted">{m}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <div aria-hidden className="hidden w-8 shrink-0 flex-col gap-1.5 sm:flex">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={i} className="flex flex-1 items-center text-2xs uppercase tracking-wider text-muted">{w}</span>
            ))}
          </div>

          {/* Weeks read as rows so the grid is announced in date order. */}
          <div
            ref={gridRef}
            role="grid"
            aria-label="Daily activity over the last 6 months"
            aria-describedby={hintId}
            onKeyDown={onKeyDown}
            className="flex min-w-0 flex-1 gap-1.5"
          >
            {weeks.map((week, wi) => (
              <div key={wi} role="row" className="flex flex-1 flex-col gap-1.5">
                {week.map((day, di) => (
                  <span
                    key={di}
                    role="gridcell"
                    data-cell={`${wi}-${di}`}
                    tabIndex={cursor[0] === wi && cursor[1] === di ? 0 : -1}
                    aria-label={describeDay(day)}
                    onFocus={(e) => { setCursor([wi, di]); showTip(e.currentTarget, day); }}
                    onBlur={() => setTip(null)}
                    onMouseEnter={(e) => showTip(e.currentTarget, day)}
                    onMouseLeave={() => setTip(null)}
                    className={cn(
                      "aspect-square w-full rounded-[4px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      level(day.count),
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <p id={hintId} className="sr-only">Use the arrow keys to move between days.</p>

        {tip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium shadow-lg"
            style={{ left: tip.x, top: tip.y - 8 }}
          >
            {tip.text}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {totalCount === 0
            ? "Nothing logged yet — solve a problem or play a game and the grid starts filling in."
            : `${activeDays} active ${activeDays === 1 ? "day" : "days"} · ${totalCount} in the last 6 months.`}
        </p>
        <div className="ml-auto flex items-center gap-1.5 text-2xs text-muted">
          <span>Less</span>
          {[0, 1, 3, 9].map((n) => (
            <span key={n} className={cn("h-3 w-3 rounded-[3px]", level(n))} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- streaks --------------------------- */

function streaks(activity: Record<string, number>): { current: number; best: number } {
  const days = Object.keys(activity).filter((k) => activity[k] > 0).sort();
  if (days.length === 0) return { current: 0, best: 0 };

  // best streak
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const cur = new Date(days[i]);
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  // current streak — consecutive days ending today
  let current = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (activity[dayKey(d)] > 0) {
    current++;
    d.setDate(d.getDate() - 1);
  }

  return { current, best };
}
