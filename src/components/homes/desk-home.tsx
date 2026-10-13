"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Spinner, usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { GAMES } from "@/components/shells/nav-data";
import { useMounted, usePracticeStore } from "@/store/practice-store";
import { nextStep, stepPct, trackPct, type PathsState } from "@/lib/paths";

const count = (m: Record<string, boolean>) => Object.values(m).filter(Boolean).length;

/** The desk: where you are in each path, what comes next, and the rest of the library beside it. */
export function DeskHome() {
  const { data } = usePaths<PathsState>("state");
  const mounted = useMounted();
  const solved = usePracticeStore((s) => count(s.solved));
  const bookmarked = usePracticeStore((s) => count(s.bookmarked));

  return (
    <div className="desk-home">
      <h1 className="desk-h1">Your desk</h1>
      <div className="desk-columns">
        <section className="desk-panel desk-panel-wide" aria-label="Paths">
          <h2 className="desk-h2">Open books</h2>
          {!data && <Spinner />}
          {data?.tracks.map((t) => {
            const next = nextStep(t);
            const i = t.steps.indexOf(next);
            return (
              <article key={t.id} className="desk-book">
                <div className="desk-book-head">
                  <Link href={`/paths/${t.id}`} className="desk-book-title">
                    {t.title}
                  </Link>
                  <span className="desk-book-pct">{Math.round(100 * trackPct(t))}%</span>
                </div>
                <ProgressBar value={trackPct(t)} />
                <Link href={`/paths/${t.id}/${next.id}`} className="desk-next">
                  <span>
                    Chapter {i + 1}: {next.title}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <ol className="desk-upcoming">
                  {t.steps.slice(i + 1, i + 4).map((s, k) => (
                    <li key={s.id}>
                      <Link href={`/paths/${t.id}/${s.id}`}>
                        <span className="desk-upcoming-n">{i + k + 2}</span> {s.title}
                        <span className="desk-upcoming-p">{Math.round(100 * stepPct(s))}%</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </section>
        <div className="desk-stack">
          <section className="desk-panel" aria-label="Problem bank">
            <h2 className="desk-h2">Problem bank</h2>
            <p className="desk-stat">
              <strong>{mounted ? solved : "–"}</strong> solved · <strong>{mounted ? bookmarked : "–"}</strong> bookmarked
            </p>
            <div className="desk-links">
              <Link href="/practice">All problems</Link>
              <Link href="/practice?status=Unsolved">Unsolved</Link>
              <Link href="/practice?status=Bookmarked">Bookmarked</Link>
            </div>
          </section>
          <section className="desk-panel" aria-label="Games">
            <h2 className="desk-h2">Games</h2>
            <ul className="desk-gamelist">
              {GAMES.map((g) => (
                <li key={g.href}>
                  <Link href={g.href}>{g.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
