"use client";

import * as React from "react";
import {
  Play, RotateCcw, ArrowRight, Flag, TrendingUp, TrendingDown,
  SkipForward, Trophy, Crown, Settings2, Timer, Check, Minus,
} from "lucide-react";
import {
  useMocStore,
  playerPnl,
  TOTAL_ROUNDS,
  DEFAULT_MOC_CONFIG,
  MOC_OPTIONS,
  type MocConfig,
  type Player,
} from "@/store/market-of-cards-store";
import {
  isRed, sumValue, quickTotalEV, exactTotalEV, TABLE_MID, QUICK_EV,
  type Card,
} from "@/lib/market-of-cards";
import { cn, formatSigned } from "@/lib/utils";
import { useRecordGame } from "@/store/practice-store";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MarketOfCardsGame() {
  const phase = useMocStore((s) => s.phase);
  if (phase === "intro") return <Intro />;
  if (phase === "gameover") return <GameOver />;
  return <GameScreen />;
}

/* ---------------------------------- cards ---------------------------- */

function MiniCard({ card }: { card: Card }) {
  if (!card.faceUp) {
    return (
      <div className="h-[6.5rem] w-[4.5rem] shrink-0 rounded-lg border border-accent/40 bg-surface-2 bg-[repeating-linear-gradient(45deg,transparent,transparent_7px,rgba(139,92,246,0.18)_7px,rgba(139,92,246,0.18)_14px)] shadow-sm" />
    );
  }
  const ink = isRed(card.suit) ? "#d4163c" : "#17171d";
  return (
    <div className="relative h-[6.5rem] w-[4.5rem] shrink-0 rounded-lg border border-zinc-300 bg-white shadow-md" style={{ color: ink }}>
      <span className="absolute left-1.5 top-1 text-base font-bold leading-none">{card.rank}</span>
      <span className="absolute left-1.5 top-[22px] text-xs leading-none">{card.suit}</span>
      <span className="absolute inset-0 grid place-items-center text-4xl">{card.suit}</span>
      <span className="absolute bottom-1 right-1.5 rotate-180 text-base font-bold leading-none">{card.rank}</span>
    </div>
  );
}

function PlayerSpot({
  player, pnl, align = "center",
}: {
  player: Player;
  pnl?: number;
  align?: "center" | "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col gap-1", align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center")}>
      <span className={cn("text-xs font-semibold", player.isYou ? "text-accent" : "text-muted")}>{player.name}</span>
      <div className="flex gap-1.5">
        {player.hand.map((c, i) => <MiniCard key={i} card={c} />)}
      </div>
      {pnl !== undefined && (
        <span className={cn("font-mono text-xs font-semibold", pnl > 0 && "text-positive", pnl < 0 && "text-negative", pnl === 0 && "text-muted")}>
          {formatSigned(pnl)}
        </span>
      )}
    </div>
  );
}

function Felt({ pnls }: { pnls?: number[] }) {
  const { players, table } = useMocStore();
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface-2/30 p-5">
      <div className="flex justify-center">
        <PlayerSpot player={players[2]} pnl={pnls?.[2]} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <PlayerSpot player={players[1]} pnl={pnls?.[1]} align="left" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted">Table</span>
          <div className="flex gap-1.5">
            {table.map((c, i) => <MiniCard key={i} card={c} />)}
          </div>
        </div>
        <PlayerSpot player={players[3]} pnl={pnls?.[3]} align="right" />
      </div>
      <div className="flex justify-center">
        <PlayerSpot player={players[0]} pnl={pnls?.[0]} />
      </div>
    </div>
  );
}

/* ---------------------------------- intro ---------------------------- */

function Intro() {
  const start = useMocStore((s) => s.start);
  const saved = useMocStore((s) => s.config);
  const [config, setConfig] = React.useState<MocConfig>(saved ?? DEFAULT_MOC_CONFIG);

  return (
    <UICard className="obsidian-glow mx-auto max-w-2xl">
      <CardContent className="space-y-7 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-lg">
            <Crown className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight">Market of Cards</h2>
          <p className="max-w-md text-muted">
            You and three AI traders each hold two hidden cards; three more sit
            face-down on the table — 11 cards in all. Quote a two-way market on
            their total value, trade as cards are revealed each round, and settle
            at the true sum. (Deck sums to 2200, mean {QUICK_EV} per card.)
          </p>
        </div>

        <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-surface-2/40 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="h-4 w-4 text-accent" /> Game settings
          </div>
          <Segmented
            label="Decision timer"
            options={MOC_OPTIONS.decisionSeconds}
            value={config.decisionSeconds}
            onChange={(v) => setConfig((c) => ({ ...c, decisionSeconds: v }))}
            suffix="s"
          />
          <Toggle label="Show EV hint (quick & exact)" checked={config.showEV} onChange={(v) => setConfig((c) => ({ ...c, showEV: v }))} />
          <Toggle label="Show game log" checked={config.showLog} onChange={(v) => setConfig((c) => ({ ...c, showLog: v }))} />
        </div>

        <div className="flex justify-center">
          <Button size="lg" onClick={() => start(config)}>
            <Play className="h-4 w-4" /> Start game
          </Button>
        </div>
      </CardContent>
    </UICard>
  );
}

function Segmented<T extends number>({
  label, options, value, onChange, suffix = "",
}: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; suffix?: string }) {
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
              value === opt ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {opt}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--accent)" }}
        className="h-4 w-4"
      />
    </label>
  );
}

function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = React.useState(seconds);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onExpire();
      }
    }, 100);
    return () => clearInterval(id);
  }, [seconds, onExpire]);

  const pct = Math.max(0, (left / seconds) * 100);
  const danger = left <= seconds * 0.35;
  return (
    <div className="mx-auto max-w-md space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted"><Timer className="h-3.5 w-3.5" /> Time to act</span>
        <span className={cn("font-mono font-semibold", danger ? "text-negative" : "text-foreground")}>{Math.ceil(left)}s</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", danger ? "bg-negative" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------- game screen ------------------------ */

function GameScreen() {
  const { phase, round, config, players, table, revealed, endGame } = useMocStore();
  const you = players[0];
  const known = [...you.hand, ...table.slice(0, revealed)];
  const quick = quickTotalEV(sumValue(known), known.length);
  const exact = exactTotalEV(sumValue(known), known.length);

  return (
    <div className="space-y-4">
      <UICard>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-base font-semibold">
            Round {round}
            <span className="ml-1.5 text-sm font-normal text-muted">of {TOTAL_ROUNDS}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={endGame}>
            <Flag className="h-4 w-4" /> Settle &amp; end
          </Button>
        </CardContent>
      </UICard>

      <div key={round} className="animate-round space-y-4">
        <Felt />

        {config.showEV && (
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Badge tone="outline">Quick EV ≈ <span className="ml-1 font-mono font-semibold text-foreground">{quick.toFixed(0)}</span></Badge>
            <Badge tone="accent">Exact EV ≈ <span className="ml-1 font-mono font-semibold">{exact.toFixed(0)}</span></Badge>
            <Badge tone="default">Table mid {TABLE_MID}</Badge>
          </div>
        )}

        {phase === "quote" && <QuotePanel />}
        {phase === "reactions" && <ReactionsPanel />}
        {phase === "trade" && <TradePanel />}
      </div>

      <div className={cn("grid gap-4", config.showLog && "lg:grid-cols-2")}>
        {config.showLog && <GameLog />}
        <TradeLog />
      </div>
    </div>
  );
}

function ReactionsPanel() {
  const { reactions, continueToTrade } = useMocStore();
  return (
    <div className="animate-pop space-y-4">
      <p className="text-center text-sm font-medium">How the AIs traded against your market</p>
      <div className="mx-auto grid max-w-md gap-2">
        {reactions.map((r) => {
          const acted = r.action !== "passed";
          return (
            <div key={r.name} className={cn("flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm", acted ? "border-accent/40 bg-accent/5" : "border-border bg-surface-2/40")}>
              <span className="flex items-center gap-2">
                <span className={cn("grid h-6 w-6 place-items-center rounded-full", acted ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}>
                  {acted ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </span>
                <span className="font-medium">{r.name}</span>
              </span>
              <span className={cn("text-sm", acted ? "text-foreground" : "text-muted")}>
                {r.action === "bought" ? `bought from you @ ${r.price}` : r.action === "sold" ? `sold to you @ ${r.price}` : "passed — no edge"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center">
        <Button size="lg" onClick={continueToTrade}>Trade their markets <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function QuotePanel() {
  const submitQuote = useMocStore((s) => s.submitQuote);
  const [bid, setBid] = React.useState("");
  const [ask, setAsk] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = Number(bid);
    const a = Number(ask);
    if (bid === "" || ask === "" || Number.isNaN(b) || Number.isNaN(a)) return setError("Enter a bid and an ask.");
    if (a <= b) return setError("Your ask must be above your bid.");
    setError(null);
    submitQuote(b, a);
  };

  return (
    <form onSubmit={submit} className="animate-pop space-y-4">
      <p className="text-center text-sm font-medium">Quote a two-way market on the total value of the 11 cards.</p>
      <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
        <PriceInput label="Bid (you buy)" value={bid} onChange={setBid} placeholder="e.g. 450" />
        <PriceInput label="Ask (you sell)" value={ask} onChange={setAsk} placeholder="e.g. 480" />
      </div>
      {error && <p className="text-center text-sm text-negative">{error}</p>}
      <div className="flex justify-center">
        <Button type="submit" size="lg">Submit quote <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}

function PriceInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-border bg-surface-2 px-3 font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function TradePanel() {
  const { aiQuotes, currentAi, tradeWithAi, players, config } = useMocStore();
  const q = aiQuotes[currentAi];
  if (!q) return null;
  const name = players[currentAi + 1].name;

  return (
    <div className="animate-pop space-y-4">
      <Countdown key={currentAi} seconds={config.decisionSeconds} onExpire={() => tradeWithAi("pass")} />
      <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm">
        <span className="font-semibold">{name}</span> quotes{" "}
        <span className="font-mono font-semibold text-positive">bid {q.bid}</span> /{" "}
        <span className="font-mono font-semibold text-negative">ask {q.ask}</span>
      </div>
      <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
        <Button variant="outline" className="h-auto flex-col gap-0 py-2.5 border-positive/40 text-positive hover:bg-positive/10" onClick={() => tradeWithAi("buy")}>
          <span className="flex items-center gap-1.5 font-semibold">Buy <TrendingUp className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">at {q.ask}</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-0 py-2.5 border-negative/40 text-negative hover:bg-negative/10" onClick={() => tradeWithAi("sell")}>
          <span className="flex items-center gap-1.5 font-semibold">Sell <TrendingDown className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">at {q.bid}</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-0 py-2.5" onClick={() => tradeWithAi("pass")}>
          <span className="flex items-center gap-1.5 font-semibold">Pass <SkipForward className="h-4 w-4" /></span>
          <span className="text-[11px] font-normal text-muted">no trade</span>
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- logs ----------------------------- */

function GameLog() {
  const log = useMocStore((s) => s.log);
  return (
    <UICard>
      <CardHeader className="py-3"><CardTitle className="text-sm">Game log</CardTitle></CardHeader>
      <CardContent>
        <div className="h-40 overflow-y-auto rounded-lg border border-border bg-surface-2/40 p-3 font-mono text-xs leading-relaxed text-muted">
          {[...log].reverse().map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </CardContent>
    </UICard>
  );
}

function TradeLog() {
  const { trades, players } = useMocStore();
  const nm = (i: number) => players[i]?.name ?? `P${i}`;
  return (
    <UICard>
      <CardHeader className="py-3"><CardTitle className="text-sm">Trade log</CardTitle></CardHeader>
      <CardContent>
        <div className="h-40 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface text-left uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 font-medium">Round</th>
                <th className="pb-2 font-medium">Buyer</th>
                <th className="pb-2 font-medium">Seller</th>
                <th className="pb-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {trades.length === 0 ? (
                <tr><td colSpan={4} className="py-3 text-center text-muted">No trades yet.</td></tr>
              ) : (
                trades.map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5">{t.round}</td>
                    <td className={cn("py-1.5", t.buyer === 0 ? "text-accent" : "text-positive")}>{nm(t.buyer)}</td>
                    <td className={cn("py-1.5", t.seller === 0 ? "text-accent" : "text-negative")}>{nm(t.seller)}</td>
                    <td className="py-1.5 text-right font-semibold">{t.price}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </UICard>
  );
}

/* -------------------------------- game over -------------------------- */

function GameOver() {
  const { trades, trueSum, players, reset } = useMocStore();
  useRecordGame();
  const pnls = playerPnl(trades, trueSum);
  const ranked = players
    .map((p, i) => ({ p, i, pnl: pnls[i] }))
    .sort((a, b) => b.pnl - a.pnl);
  const youPnl = pnls[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <UICard className="obsidian-glow">
        <CardContent className="space-y-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
              <Trophy className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-black uppercase tracking-tight">Settlement</h2>
            <p className="text-sm text-muted">The 11 cards summed to <span className="font-mono font-semibold text-foreground">{trueSum}</span>.</p>
            <div className={cn("font-mono text-3xl font-bold", youPnl > 0 ? "text-positive" : youPnl < 0 ? "text-negative" : "text-foreground")}>
              {formatSigned(youPnl)}
            </div>
            <span className="text-sm text-muted">your PnL</span>
          </div>

          <ol className="mx-auto max-w-md space-y-2">
            {ranked.map((r, i) => (
              <li key={r.i} className={cn("flex items-center justify-between rounded-lg border px-4 py-2.5", r.p.isYou ? "border-accent/50 bg-accent/5" : "border-border bg-surface-2/40")}>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted">#{i + 1}</span>
                  <span className="font-medium">{r.p.name}</span>
                  {r.p.isYou && <Badge tone="accent">You</Badge>}
                </span>
                <span className={cn("font-mono font-semibold", r.pnl > 0 && "text-positive", r.pnl < 0 && "text-negative", r.pnl === 0 && "text-muted")}>
                  {formatSigned(r.pnl)}
                </span>
              </li>
            ))}
          </ol>

          <div className="flex justify-center">
            <Button size="lg" onClick={reset}><RotateCcw className="h-4 w-4" /> Play again</Button>
          </div>
        </CardContent>
      </UICard>

      <UICard>
        <CardHeader><CardTitle className="text-base">Revealed table</CardTitle></CardHeader>
        <CardContent><Felt pnls={pnls} /></CardContent>
      </UICard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GameLog />
        <TradeLog />
      </div>
    </div>
  );
}
