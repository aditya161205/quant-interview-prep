"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { usePaths } from "@/components/paths/load";
import { ProgressBar } from "@/components/paths/progress-bar";
import { useMounted, usePracticeStore } from "@/store/practice-store";
import { nextStep, trackPct, type PathsState } from "@/lib/paths";
import { FREE_GAMES, GAMES, TRACK_JACKET } from "@/lib/pit";

const FIRMS = ["Jane Street", "Citadel", "Susquehanna International Group", "Optiver", "IMC Trading", "Hudson River Trading"];
const FIRM_CODES = ["JST", "CIT", "SIG", "OPT", "IMC", "HRT"];

const count = (m: Record<string, boolean>) => Object.values(m).filter(Boolean).length;

/** The dashboard as the trading floor: your book up top, then one jacket per part of the site. */
export function HomeFloor({ pro }: { pro: boolean }) {
  const { data } = usePaths<PathsState>("state");
  const mounted = useMounted();
  const solved = usePracticeStore((s) => count(s.solved));
  const games = usePracticeStore((s) => s.games);
  const trader = data?.tracks.find((t) => t.id === "trader");
  const researcher = data?.tracks.find((t) => t.id === "researcher");
  const pct = (t?: PathsState["tracks"][number]) => (t ? `${Math.round(100 * trackPct(t))}%` : "–");

  const book = [
    { n: mounted ? String(solved) : "–", label: "Problems solved" },
    { n: pct(trader), label: "Quant Trader path" },
    { n: pct(researcher), label: "Quant Researcher path" },
    { n: mounted ? String(games) : "–", label: "Games played" },
  ];

  return (
    <div className="space-y-5">
      <section className="full-bleed bg-jacket text-jacket-ink">
        <div className="mx-auto grid max-w-[96rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:py-16">
          <div>
            <h1 className="font-xx text-[clamp(2.05rem,5.2vw,4.4rem)] font-black uppercase leading-[1.02] tracking-[-0.03em]">
              Crack the{" "}
              <mark className="rounded-[6px] bg-jacket-ink px-[0.18em] text-jacket [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                trading desk
              </mark>{" "}
              interview
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed opacity-90">
              Interview problems from the firms that ask them, two step-by-step paths, and six market-making games.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={trader ? `/paths/trader/${nextStep(trader).id}` : "/paths"}
                className="font-x inline-flex h-12 items-center gap-2 rounded-[6px] bg-jacket-ink px-7 font-bold text-jacket transition hover:brightness-95"
              >
                {trader && trackPct(trader) > 0 ? "Continue your path" : "Start a path"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/practice"
                className="font-x inline-flex h-12 items-center rounded-[6px] border-[1.5px] border-jacket-ink px-7 font-bold transition hover:bg-jacket-ink hover:text-jacket"
              >
                Practice problems
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 self-end overflow-hidden rounded-[6px] bg-black/20">
            {book.map((b, i) => (
              <div key={b.label} className={`p-5 ${i % 2 ? "border-l border-white/15" : ""} ${i > 1 ? "border-t border-white/15" : ""}`}>
                <dd className="font-xx text-[2.4rem] font-black leading-none tabular-nums">{b.n}</dd>
                <dt className="mt-2 text-xs font-bold uppercase tracking-[0.08em] opacity-80">{b.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="min-w-0 rounded-2xl bg-[#1d3fbf] p-5 text-white sm:p-7 shadow-(--shadow-card) lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="font-xx text-2xl font-black uppercase tracking-[-0.01em] sm:text-3xl">Paths</h2>
            <Link href="/paths" className="text-sm font-bold opacity-85 hover:opacity-100">
              Both paths →
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {(data?.tracks ?? []).map((t) => {
              const next = nextStep(t);
              return (
                <Link
                  key={t.id}
                  href={`/paths/${t.id}/${next.id}`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:gap-x-5 rounded-[8px] bg-white/10 p-4 transition-colors hover:bg-white/15"
                >
                  <span
                    className="font-xx row-span-2 grid h-12 min-w-14 place-items-center rounded-[4px] bg-white text-lg font-black sm:h-14 sm:min-w-[4.5rem] sm:text-xl"
                    style={{ color: TRACK_JACKET[t.id]?.color }}
                  >
                    {TRACK_JACKET[t.id]?.code}
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-x min-w-0 text-lg font-extrabold leading-tight sm:text-xl">{t.title}</span>
                    <span className="font-x shrink-0 font-black tabular-nums">{Math.round(100 * trackPct(t))}%</span>
                  </div>
                  <div>
                    <ProgressBar value={trackPct(t)} onJacket />
                    <p className="mt-2 truncate text-sm opacity-85">
                      Next: {next.title}
                      {next.locked && <Lock className="ml-1.5 inline h-3.5 w-3.5" aria-label="Pro" />}
                    </p>
                  </div>
                </Link>
              );
            })}
            {!data && <div className="h-40 animate-pulse rounded-[8px] bg-white/10" />}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-[#c8102e] p-5 text-white sm:p-7 shadow-(--shadow-card) lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="font-xx text-2xl font-black uppercase tracking-[-0.01em] sm:text-3xl">Practice</h2>
            <Link href="/practice" className="text-sm font-bold opacity-85 hover:opacity-100">
              All problems →
            </Link>
          </div>
          <p className="mt-3 text-sm opacity-90">Probability, brainteasers and statistics, asked at the firms below.</p>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["Easy", "Medium", "Hard"] as const).map((d) => (
              <Link
                key={d}
                href={`/practice?difficulty=${d}`}
                className="font-x rounded-[6px] bg-white/12 px-3 py-4 text-center text-sm font-extrabold uppercase tracking-[0.06em] transition-colors hover:bg-white hover:text-[#c8102e]"
              >
                {d}
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {FIRMS.map((f, i) => (
              <Link
                key={f}
                href={`/practice?company=${encodeURIComponent(f)}`}
                title={f}
                className="font-xx rounded-[3px] bg-white px-2.5 py-1.5 text-xs font-black tracking-[0.06em] text-[#c8102e] transition hover:-translate-y-0.5"
              >
                {FIRM_CODES[i]}
              </Link>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-[#e8a400] p-5 text-[#1a1300] sm:p-7 shadow-(--shadow-card) lg:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 className="font-xx text-2xl font-black uppercase tracking-[-0.01em] sm:text-3xl">Market making</h2>
            <Link href="/market-making" className="text-sm font-bold opacity-85 hover:opacity-100">
              The pits →
            </Link>
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {GAMES.map((g, i) => (
              <li key={g.href}>
                <Link
                  href={g.href}
                  className="group flex h-full flex-col gap-3 rounded-[8px] bg-black/8 p-4 transition-colors hover:bg-black/15"
                >
                  <span className="font-xx grid h-11 w-16 place-items-center rounded-[4px] bg-[#1a1300] text-base font-black tracking-[0.04em] text-[#e8a400]">
                    {g.code}
                  </span>
                  <span className="font-x font-extrabold leading-tight">
                    {g.title}
                    {!pro && i >= FREE_GAMES && <Lock className="ml-1.5 inline h-3.5 w-3.5 opacity-70" aria-label="Pro" />}
                  </span>
                  <span className="text-xs font-semibold opacity-75">{g.kind}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
