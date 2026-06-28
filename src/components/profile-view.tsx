"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, Bookmark, Gamepad2, Flame, ArrowRight } from "lucide-react";
import { problems, type Difficulty, type Topic } from "@/data/problems";
import { usePracticeStore, useMounted, dayKey } from "@/store/practice-store";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HEATMAP_WEEKS = 26;

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

  const solvedList = problems.filter((p) => solved[p.id]);
  const bookmarkedList = problems.filter((p) => booked[p.id]);

  const byDifficulty: Record<Difficulty, { total: number; done: number }> = {
    Easy: { total: 0, done: 0 },
    Medium: { total: 0, done: 0 },
    Hard: { total: 0, done: 0 },
  };
  const byTopic: Record<string, { total: number; done: number }> = {};
  for (const p of problems) {
    byDifficulty[p.difficulty].total++;
    if (solved[p.id]) byDifficulty[p.difficulty].done++;
    byTopic[p.topic] ??= { total: 0, done: 0 };
    byTopic[p.topic].total++;
    if (solved[p.id]) byTopic[p.topic].done++;
  }

  const { current, best } = streaks(acts);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CircleCheck} label="Problems solved" value={`${solvedList.length}/${problems.length}`} />
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
          <CardContent className="space-y-3">
            {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
              <ProgressRow key={d} label={<DifficultyBadge difficulty={d} />} done={byDifficulty[d].done} total={byDifficulty[d].total} />
            ))}
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bookmarked problems</CardTitle>
            <Link href="/practice" className="inline-flex items-center gap-1 text-sm font-medium text-accent">
              All problems <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {bookmarkedList.length === 0 ? (
            <p className="py-2 text-sm text-muted">No bookmarks yet — tap the bookmark icon on any problem to save it here.</p>
          ) : (
            <div className="space-y-2">
              {bookmarkedList.map((p) => (
                <Link key={p.id} href={`/practice/${p.id}`} className="group flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5 transition-colors hover:border-accent/50">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium group-hover:text-accent">{p.title}</span>
                  {solved[p.id] && <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />}
                  <DifficultyBadge difficulty={p.difficulty} className="hidden sm:inline-flex" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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

function level(count: number): string {
  if (count <= 0) return "bg-surface-2";
  if (count <= 2) return "bg-accent/30";
  if (count <= 5) return "bg-accent/60";
  return "bg-accent";
}

function Heatmap({ activity }: { activity: Record<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const weeks: { date: Date; count: number }[][] = [];
  const d = new Date(start);
  while (d <= today) {
    const week: { date: Date; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      if (d <= today) {
        week.push({ date: new Date(d), count: activity[dayKey(d)] ?? 0 });
      }
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) => (
                <span
                  key={di}
                  title={`${dayKey(day.date)}: ${day.count} ${day.count === 1 ? "activity" : "activities"}`}
                  className={cn("h-3 w-3 rounded-[3px]", level(day.count))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted">
        <span>Less</span>
        <span className="h-3 w-3 rounded-[3px] bg-surface-2" />
        <span className="h-3 w-3 rounded-[3px] bg-accent/30" />
        <span className="h-3 w-3 rounded-[3px] bg-accent/60" />
        <span className="h-3 w-3 rounded-[3px] bg-accent" />
        <span>More</span>
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
