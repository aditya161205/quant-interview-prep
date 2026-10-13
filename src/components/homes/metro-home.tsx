"use client";

import Link from "next/link";
import { Spinner, usePaths } from "@/components/paths/load";
import { LineBullet } from "@/components/shells/metro-shell";
import { GAMES } from "@/components/shells/nav-data";
import { MetroRoute, sharedSteps } from "@/components/homes/metro-map";
import type { PathsState } from "@/lib/paths";

const PRACTICE_STOPS = [
  { href: "/practice", title: "All problems" },
  { href: "/practice?difficulty=Easy", title: "Easy" },
  { href: "/practice?difficulty=Medium", title: "Medium" },
  { href: "/practice?difficulty=Hard", title: "Hard" },
  { href: "/practice?status=Bookmarked", title: "Bookmarked" },
];

function StaticRoute({ title, color, code, href, stops }: { title: string; color: string; code: string; href: string; stops: { href: string; title: string }[] }) {
  return (
    <section className="metro-route" style={{ ["--line" as string]: color }}>
      <header className="metro-route-head">
        <LineBullet color={color} code={code} size="lg" />
        <Link href={href} className="metro-route-title">
          {title}
        </Link>
      </header>
      <div className="metro-scroll">
        <ol className="metro-line">
          {stops.map((s) => (
            <li key={s.href} className="metro-station">
              <Link href={s.href}>
                <span className="metro-dot" aria-hidden />
                <span className="metro-name">{s.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The dashboard as a network map: both paths, the problem bank and the games, each a line. */
export function MetroHome() {
  const { data } = usePaths<PathsState>("state");
  const shared = data ? sharedSteps(data) : new Set<string>();
  return (
    <div className="metro-home">
      <div className="metro-home-head">
        <h1 className="metro-h1">The QuantPrep network</h1>
        <p className="metro-sub">
          Ride a path from its first station to its capstone. ◎ marks an interchange: a step both paths share, so progress
          there counts on both lines.
        </p>
      </div>
      <div className="metro-map">
        {data ? data.tracks.map((t) => <MetroRoute key={t.id} track={t} shared={shared} />) : <Spinner />}
        <StaticRoute title="Practice line" color="#11905a" code="P" href="/practice" stops={PRACTICE_STOPS} />
        <StaticRoute title="Market making line" color="#ee8a00" code="M" href="/market-making" stops={GAMES} />
      </div>
    </div>
  );
}
