import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { hasPro } from "@/lib/billing";
import { FREE_GAMES, GAMES, POKER } from "@/lib/pit";

export const metadata = {
  title: "Games — QuantPrep",
};

const FLOOR_GREEN = "#0c6b45";
const POKER_TEAL = "#0e6f7a";

/** The pits: one row per game on a trading board, each with its badge code. */
export default async function MarketMakingHub() {
  const pro = await hasPro();
  const rows = [
    ...GAMES.map((g, i) => ({ ...g, locked: !pro && i >= FREE_GAMES, plate: FLOOR_GREEN })),
    { ...POKER, locked: false, plate: POKER_TEAL },
  ];
  return (
    <div>
      <PageHeader
        title="Games"
        description="Market-making games that drill quoting, pricing and sizing under a clock, plus poker. Pick a pit."
        aside={
          <p className="font-xx text-[3.4rem] font-black leading-none tabular-nums">
            {rows.length}<span className="ml-2 align-middle text-sm font-bold uppercase tracking-[0.08em] opacity-80">games</span>
          </p>
        }
      />
      <ol className="overflow-hidden rounded-2xl bg-surface shadow-(--shadow-card)">
        {rows.map((g) => {
          const { locked } = g;
          return (
            <li key={g.href} className="border-b border-border last:border-b-0">
              <Link
                href={g.href}
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 sm:gap-x-6 gap-y-1 px-5 py-6 transition-colors hover:bg-(--green-wash) sm:px-7"
              >
                <span style={{ background: g.plate }} className="font-code row-span-2 grid h-12 w-16 place-items-center rounded-[4px] text-lg font-black sm:h-16 sm:w-24 sm:text-2xl tracking-[0.04em] text-white transition-transform group-hover:-translate-y-0.5 sm:row-span-1">
                  {g.code}
                </span>
                <span className="min-w-0 sm:grid sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <span className="block">
                    <span className="font-x block text-xl font-extrabold leading-tight">{g.title}</span>
                    <span className="mt-1 block text-xs font-bold uppercase tracking-[0.08em] text-muted">{g.kind}</span>
                  </span>
                  <span className="mt-2 hidden text-sm leading-relaxed text-muted sm:mt-0 sm:block">{g.blurb}</span>
                </span>
                <span className="font-x row-span-2 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.06em] sm:row-span-1">
                  {locked ? (
                    <>
                      <Lock className="h-4 w-4" /> <span className="hidden sm:inline">Pro</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Play</span> <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
