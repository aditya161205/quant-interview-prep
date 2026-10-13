"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { LineBullet } from "@/components/shells/metro-shell";
import { KIND_LABEL, stepPct, trackPct, type PathsState, type StepSummary, type Track } from "@/lib/paths";
import { cn } from "@/lib/utils";

export const TRACK_LINE: Record<string, { color: string; code: string }> = {
  trader: { color: "#d4202c", code: "T" },
  researcher: { color: "#0b5fb4", code: "R" },
};

/** Steps that sit on both paths: drawn as interchanges, since progress there counts on both. */
export function sharedSteps(state: PathsState): Set<string> {
  const [a, b] = state.tracks;
  if (!a || !b) return new Set();
  const other = new Set(b.steps.map((s) => s.id));
  return new Set(a.steps.filter((s) => other.has(s.id)).map((s) => s.id));
}

function stationClass(s: StepSummary, shared: Set<string>) {
  const p = stepPct(s);
  return cn("metro-station", p >= 1 && "is-done", p > 0 && p < 1 && "is-started", shared.has(s.id) && "is-shared", s.locked && "is-locked");
}

/** One path as a horizontal line of stations, labels slanted as on a printed map. */
export function MetroRoute({ track, shared }: { track: Track; shared: Set<string> }) {
  const line = TRACK_LINE[track.id] ?? { color: "#444", code: "?" };
  return (
    <section className="metro-route" style={{ ["--line" as string]: line.color }}>
      <header className="metro-route-head">
        <LineBullet color={line.color} code={line.code} size="lg" />
        <Link href={`/paths/${track.id}`} className="metro-route-title">
          {track.title} line
        </Link>
        <span className="metro-route-meta">
          {track.steps.length} stations · {Math.round(100 * trackPct(track))}% travelled
        </span>
      </header>
      <div className="metro-scroll">
        <ol className="metro-line">
          {track.steps.map((s) => (
            <li key={s.id} className={stationClass(s, shared)}>
              <Link href={`/paths/${track.id}/${s.id}`} title={`${s.title} · ${Math.round(100 * stepPct(s))}%`}>
                <span className="metro-dot" aria-hidden />
                <span className="metro-name">
                  {s.title}
                  {s.locked && <Lock className="ml-1 inline h-3 w-3" aria-label="Pro" />}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** One path drawn down the page: the track view in the Metro version. */
export function MetroTrack({ track, state }: { track: Track; state: PathsState }) {
  const shared = sharedSteps(state);
  const line = TRACK_LINE[track.id] ?? { color: "#444", code: "?" };
  const other = state.tracks.find((t) => t.id !== track.id);
  return (
    <div className="metro-track" style={{ ["--line" as string]: line.color }}>
      <header className="metro-track-head">
        <LineBullet color={line.color} code={line.code} size="lg" />
        <div>
          <h1 className="metro-h1">{track.title} line</h1>
          <p className="metro-sub">
            {track.steps.length} stations · {Math.round(100 * trackPct(track))}% travelled
            {other && <> · ◎ interchange with the {other.title} line</>}
          </p>
        </div>
      </header>
      <ol className="metro-vline">
        {track.steps.map((s) => {
          const p = stepPct(s);
          return (
            <li key={s.id} className={stationClass(s, shared)}>
              <Link href={s.locked ? "/pricing" : `/paths/${track.id}/${s.id}`} className="metro-vstop">
                <span className="metro-dot" aria-hidden />
                <span className="metro-vname">
                  {s.title}
                  {s.locked && <Lock className="ml-1.5 inline h-3.5 w-3.5" aria-label="Pro" />}
                </span>
                <span className="metro-vmeta">
                  {KIND_LABEL[s.kind]} · Lesson{s.n_q > 0 && ` · Questions ${s.done_q}/${s.n_q}`}
                  {s.n_p > 0 && ` · Code ${s.done_p}/${s.n_p}`}
                  {shared.has(s.id) && other && ` · also on ${other.title}`}
                </span>
                <span className="metro-vpct">{Math.round(100 * p)}%</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
