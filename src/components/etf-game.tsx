"use client";

import * as React from "react";
import {
  Play,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  SkipForward,
  Timer,
  Trophy,
  Cpu,
  Lock,
  CheckCircle2,
  Settings2,
  Zap,
  AlertTriangle,
  Flag,
} from "lucide-react";
import {
  useEtfStore,
  DEFAULT_ETF_CONFIG,
  type EtfConfig,
  type PlayerResult,
  type RoundRecord,
} from "@/store/etf-store";
import {
  TX_COST,
  ROUND_OPTIONS,
  MAX_UNITS_OPTIONS,
  SECONDS_OPTIONS,
  optimalAction,
} from "@/lib/etf-game";
import { cn } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* money helpers — this game is denominated in dollars */
const money = (x: number) => `$${x.toFixed(2)}`;
const total$ = (x: number) => `$${Math.round(x)}`;
const signed$ = (x: number) =>
  `${x > 0 ? "+" : x < 0 ? "-" : ""}$${Math.abs(x).toFixed(2)}`;

export function EtfGame() {
  const phase = useEtfStore((s) => s.phase);
  if (phase === "intro") return <Intro />;
  if (phase === "gameover") return <GameOver />;
  return <Table />;
}

/* ----------------------------------- intro --------------------------- */

function Intro() {
  const start = useEtfStore((s) => s.start);
  const saved = useEtfStore((s) => s.config);
  const [config, setConfig] = React.useState<EtfConfig>(saved ?? DEFAULT_ETF_CONFIG);
  const set = <K extends keyof EtfConfig>(k: K, v: EtfConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  return (
    <Card className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
            <TrendingUp className="h-6 w-6" />
          </span>
          <h2 className="text-xl font-semibold">ETF Arbitrage Game</h2>
          <p className="max-w-lg text-muted">
            Each round, compute the ETF&apos;s fair value (NAV = Σ weight × price)
            and compare it to the quoted bid/ask. Buy when it&apos;s cheap, sell
            when it&apos;s rich, skip when there&apos;s no edge — and beat 3 AI
            traders to the punch for a bonus.
          </p>
        </div>

        <HowToPlay />

        <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented label="Rounds" options={ROUND_OPTIONS} value={config.rounds} onChange={(v) => set("rounds", v)} />
          <Segmented label="Max units" options={MAX_UNITS_OPTIONS} value={config.maxUnits} onChange={(v) => set("maxUnits", v)} />
          <Segmented label="Timer" options={SECONDS_OPTIONS} value={config.seconds} onChange={(v) => set("seconds", v)} suffix="s" />
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => start(config)}>
            <Play className="h-4 w-4" /> Start game
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HowToPlay() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-left text-sm font-medium"
      >
        How to play {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="animate-pop mt-3 space-y-2 rounded-xl border border-border bg-surface-2/30 p-4 text-sm text-muted">
          <p>
            <strong className="text-foreground">NAV</strong> = Σ (weight × price).
            The table gives you the <span className="font-mono">W × P</span> column
            — just add it up.
          </p>
          <p>
            Compare NAV to the ETF quote: NAV &gt; ask →{" "}
            <span className="text-positive">Buy</span>; NAV &lt; bid →{" "}
            <span className="text-negative">Sell</span>; otherwise{" "}
            <span className="text-foreground">Skip</span>.
          </p>
          <p>
            Each trade costs <span className="font-mono">${TX_COST}</span>. The
            fastest trader each round earns a{" "}
            <span className="text-accent">+20% bonus</span> on their profit. Size
            up only when the edge is worth it.
          </p>
        </div>
      )}
    </div>
  );
}

function Segmented<T extends number>({
  label,
  options,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn(
              "h-9 min-w-11 rounded-lg border px-3 font-mono text-sm transition-colors",
              value === opt
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- countdown --------------------------- */

function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = React.useState(seconds);
  const fired = React.useRef(false);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const r = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(r);
      if (r <= 0 && !fired.current) {
        fired.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 100);
    return () => clearInterval(id);
  }, [seconds, onExpire]);
  const pct = Math.max(0, (left / seconds) * 100);
  const danger = left <= seconds * 0.35;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2 sm:w-32">
        <div
          className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", danger ? "bg-negative" : "bg-accent")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-8 text-right font-mono text-sm font-semibold", danger ? "text-negative" : "text-foreground")}>
        {Math.ceil(left)}s
      </span>
    </div>
  );
}

/* ----------------------------------- table --------------------------- */

function Table() {
  const { phase, config, round, data, results, totals, timeout, endGame } = useEtfStore();
  if (!data) return null;
  const youTotal = totals["You"] ?? 0;
  const hasChanges = data.stocks.some((s) => s.change !== 0);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold">
              Round {round}
              <span className="ml-1.5 text-sm font-normal text-muted">of {config.rounds}</span>
            </span>
            <span className="text-sm text-muted">
              P&amp;L{" "}
              <span className={cn("font-mono font-semibold", youTotal > 0 && "text-positive", youTotal < 0 && "text-negative", youTotal === 0 && "text-foreground")}>
                {total$(youTotal)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {phase === "trading" ? (
              <Countdown seconds={config.seconds} onExpire={timeout} />
            ) : (
              <Badge tone="outline">Round complete</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={endGame}>
              <Flag className="h-4 w-4" /> End game
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyed by round so the whole board re-animates on every new round */}
      <div key={round} className="animate-round space-y-4">
        {data.event && (
          <div className="animate-pop flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {data.event}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Left column: basket + your action */}
        <div className="space-y-4">
        <Card className="animate-pop">
          <CardHeader className="py-4">
            <CardTitle className="text-base">{data.basket}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-2 font-medium">Ticker</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    {hasChanges && <th className="pb-2 text-right font-medium">Change</th>}
                    <th className="pb-2 text-right font-medium">Weight</th>
                    <th className="pb-2 text-right font-medium">W × P</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {data.stocks.map((s) => (
                    <tr key={s.ticker} className="border-t border-border">
                      <td className="py-2 font-sans font-semibold">{s.ticker}</td>
                      <td className="py-2 text-right">{money(s.price)}</td>
                      {hasChanges && (
                        <td className={cn("py-2 text-right", s.change > 0 ? "text-positive" : s.change < 0 ? "text-negative" : "text-muted")}>
                          {s.change > 0 ? "+" : ""}
                          {s.change.toFixed(2)}
                        </td>
                      )}
                      <td className="py-2 text-right text-muted">{s.weight.toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold">{money(s.weight * s.price)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border">
                    <td className="pt-2 font-sans text-xs uppercase tracking-wider text-muted" colSpan={hasChanges ? 4 : 3}>
                      NAV = Σ (W × P)
                    </td>
                    <td className="pt-2 text-right">
                      {phase === "trading" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-muted">
                          <Lock className="h-3 w-3" /> ???
                        </span>
                      ) : (
                        <span className="animate-pop inline-block font-mono text-base font-bold text-accent">{money(data.nav)}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">ETF bid</span>
                <span className="font-mono font-semibold text-positive">{money(data.etfBid)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sm text-muted">ETF ask</span>
                <span className="font-mono font-semibold text-negative">{money(data.etfAsk)}</span>
              </div>
              <div className="mt-2 border-t border-border pt-2 text-center text-xs text-muted">
                Transaction cost: ${TX_COST} per trade
              </div>
            </div>
          </CardContent>
        </Card>

        {phase === "trading" ? <TradeControls /> : <ResultFooter />}
        </div>

        {/* Right column: players */}
        <div className="space-y-3">
          <PlayersPanel results={results} totals={totals} trading={phase === "trading"} />
        </div>
        </div>
      </div>
    </div>
  );
}

function PlayersPanel({
  results,
  totals,
  trading,
}: {
  results: PlayerResult[] | null;
  totals: Record<string, number>;
  trading: boolean;
}) {
  const bots = useEtfStore((s) => s.bots);
  const order = ["You", ...bots];

  return (
    <>
      {order.map((name, i) => {
        const isYou = name === "You";
        const res = results?.find((r) => r.name === name);
        const tot = totals[name] ?? 0;
        return (
          <div
            key={name}
            style={{ animationDelay: `${i * 70}ms` }}
            className={cn(
              "animate-pop rounded-xl border p-3 transition-colors",
              isYou ? "border-accent/70 bg-accent/[0.07] ring-1 ring-accent/30" : "border-border bg-surface",
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", isYou && "text-accent")}>
                {!isYou && <Cpu className="h-3.5 w-3.5 text-muted" />}
                {name}
                {res?.first && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 text-[10px] font-medium text-accent">
                    <Zap className="h-2.5 w-2.5" /> 1st
                  </span>
                )}
              </span>
              <span className={cn("font-mono text-sm font-semibold", tot > 0 && "text-positive", tot < 0 && "text-negative")}>
                {total$(tot)}
              </span>
            </div>

            <div className="mt-1 text-xs">
              {trading || !res ? (
                <span className="text-muted">{isYou ? "your move…" : "calculating…"}</span>
              ) : (
                <div className="animate-pop">
                  <RoundActionLine result={res} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RoundActionLine({ result }: { result: PlayerResult }) {
  if (result.action === "skip") return <span className="text-muted">Passed</span>;
  const Icon = result.action === "buy" ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center justify-between">
      <span className="flex items-center gap-1 text-muted">
        <Icon className="h-3 w-3" />
        {result.action === "buy" ? "Bought" : "Sold"} {result.units}
      </span>
      <span className={cn("font-mono font-medium", result.pnl > 0 ? "text-positive" : result.pnl < 0 ? "text-negative" : "text-muted")}>
        {signed$(result.pnl)}
      </span>
    </span>
  );
}

/* ---------------------------- trade controls ------------------------- */

function TradeControls() {
  const { submitTrade, config } = useEtfStore();
  const [units, setUnits] = React.useState(5);

  return (
    <Card className="animate-pop">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Your trade</span>
          <span className="rounded-md bg-surface-2 px-2.5 py-1 font-mono text-sm">Units: {units}</span>
        </div>
        <input
          type="range"
          min={1}
          max={config.maxUnits}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          style={{ accentColor: "var(--accent)" }}
          className="w-full"
        />
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="h-auto flex-col gap-0 py-2.5 border-positive/40 text-positive hover:bg-positive/10" onClick={() => submitTrade("buy", units)}>
            <span className="flex items-center gap-1.5 font-semibold">Buy <TrendingUp className="h-4 w-4" /></span>
            <span className="text-[11px] font-normal text-muted">at the ask</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-0 py-2.5 border-negative/40 text-negative hover:bg-negative/10" onClick={() => submitTrade("sell", units)}>
            <span className="flex items-center gap-1.5 font-semibold">Sell <TrendingDown className="h-4 w-4" /></span>
            <span className="text-[11px] font-normal text-muted">at the bid</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-0 py-2.5" onClick={() => submitTrade("skip", 0)}>
            <span className="flex items-center gap-1.5 font-semibold">Skip <SkipForward className="h-4 w-4" /></span>
            <span className="text-[11px] font-normal text-muted">no trade</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultFooter() {
  const { results, data, next, round, config } = useEtfStore();
  const you = results?.find((r) => r.name === "You");
  if (!you || !data) return null;
  const correct = you.action === optimalAction(data);
  const isLast = round >= config.rounds;

  return (
    <Card className="animate-pop">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-sm">
          {correct ? (
            <span className="flex items-center gap-1.5 text-positive">
              <CheckCircle2 className="h-4 w-4" /> Correct call
            </span>
          ) : (
            <span className="text-muted">
              Best move was to <strong className="text-foreground">{optimalAction(data)}</strong>.
            </span>
          )}
          <span className="text-muted">
            Round P&amp;L{" "}
            <span className={cn("font-mono font-semibold", you.pnl > 0 ? "text-positive" : you.pnl < 0 ? "text-negative" : "text-foreground")}>
              {signed$(you.pnl)}
            </span>
          </span>
        </div>
        <Button onClick={next}>
          {isLast ? "See results" : "Next round"} <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- game over --------------------------- */

function GameOver() {
  const { totals, bots, history, reset } = useEtfStore();
  useRecordGame();
  const ranked = ["You", ...bots]
    .map((name) => ({ name, isYou: name === "You", total: totals[name] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  const youRank = ranked.findIndex((r) => r.isYou) + 1;
  const youTotal = totals["You"] ?? 0;
  const correct = history.filter((h) => h.correct).length;
  const skipped = history.filter((h) => h.action === "skip").length;
  const traded = history.filter((h) => h.action !== "skip");
  const avgSpeed = traded.length
    ? (traded.reduce((s, h) => s + h.speed, 0) / traded.length).toFixed(1)
    : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="text-xl font-semibold">
              You finished {ordinal(youRank)} · {total$(youTotal)}
            </h2>
          </div>

          <ol className="mx-auto max-w-md space-y-2">
            {ranked.map((p, i) => (
              <li
                key={p.name}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3",
                  p.isYou ? "border-accent/50 bg-accent/5" : "border-border bg-surface-2/40",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted">#{i + 1}</span>
                  <span className="font-medium">{p.name}</span>
                  {p.isYou && <Badge tone="accent">You</Badge>}
                </span>
                <span className={cn("font-mono font-semibold", p.total > 0 && "text-positive", p.total < 0 && "text-negative")}>
                  {total$(p.total)}
                </span>
              </li>
            ))}
          </ol>

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
            <Stat label="Correct trades" value={`${correct}/${history.length}`} />
            <Stat label="Avg speed" value={avgSpeed === "—" ? "—" : `${avgSpeed}s`} />
            <Stat label="Skipped" value={String(skipped)} />
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round-by-round breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.map((r) => (
            <RecapRow key={r.round} record={r} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5 text-center">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function RecapRow({ record }: { record: RoundRecord }) {
  const detail =
    record.action === "skip"
      ? "skipped"
      : `${record.action === "buy" ? "bought" : "sold"} ${record.units} @ ${money(record.action === "buy" ? record.etfAsk : record.etfBid)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5 text-sm">
      <span className="font-mono text-muted">R{record.round}</span>
      <Badge tone={record.correct ? "positive" : "outline"}>{record.correct ? "correct" : "miss"}</Badge>
      <span className="text-muted">{detail}</span>
      <span className="ml-auto flex items-center gap-3 font-mono">
        <span className="text-muted">NAV {money(record.nav)}</span>
        <span className="text-muted">bid/ask {money(record.etfBid)}/{money(record.etfAsk)}</span>
        <span className={cn("font-semibold", record.pnl > 0 && "text-positive", record.pnl < 0 && "text-negative")}>
          {signed$(record.pnl)}
        </span>
      </span>
    </div>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
